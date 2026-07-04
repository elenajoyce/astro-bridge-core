// @ts-ignore
import Database from 'better-sqlite3';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { SwapOrder } from '@astro-bridge/sdk';

export interface DatabaseProvider {
  query(sql: string, params?: any[]): Promise<any[]>;
  execute(sql: string): Promise<void>;
  close(): Promise<void>;
}

class SqliteProvider implements DatabaseProvider {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    const stmt = this.db.prepare(sql);
    if (stmt.reader) {
      return stmt.all(...params);
    } else {
      const res = stmt.run(...params);
      return [res];
    }
  }

  async execute(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

class PostgresProvider implements DatabaseProvider {
  private client: Client;

  constructor(url: string) {
    this.client = new Client({ connectionString: url });
  }

  async connect() {
    await this.client.connect();
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    // Convert ? parameters to $1, $2, etc., for postgres compatibility
    let pgSql = sql;
    let index = 1;
    while (pgSql.includes('?')) {
      pgSql = pgSql.replace('?', `$${index++}`);
    }
    const res = await this.client.query(pgSql, params);
    return res.rows;
  }

  async execute(sql: string): Promise<void> {
    await this.client.query(sql);
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}

export class Persistence {
  private db!: DatabaseProvider;
  private dbUrl: string;

  constructor(dbUrl: string) {
    this.dbUrl = dbUrl;
  }

  public async init() {
    if (this.dbUrl.startsWith('postgres://') || this.dbUrl.startsWith('postgresql://')) {
      const provider = new PostgresProvider(this.dbUrl);
      await provider.connect();
      this.db = provider;
    } else {
      const dbPath = this.dbUrl.replace('file:', '');
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir) && dir !== '.') {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.db = new SqliteProvider(dbPath);
    }

    await this.runMigrations();
  }

  private async runMigrations() {
    const migrationsDir = path.resolve(__dirname, '../../migrations');
    const files = fs.readdirSync(migrationsDir).sort();
    
    // Create schema version tracker if it doesn't exist
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      );
    `);

    const versionRow = await this.db.query('SELECT version FROM schema_version LIMIT 1');
    const currentVersion = versionRow.length > 0 ? versionRow[0].version : 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileVersion = parseInt(file.split('_')[0], 10);
      if (fileVersion > currentVersion) {
        console.log(`Running migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        await this.db.execute(sql);
        
        // Update version
        await this.db.query('INSERT INTO schema_version (version) VALUES (?) ON CONFLICT(version) DO UPDATE SET version = ?', [fileVersion, fileVersion]);
      }
    }
  }

  public async query(sql: string, params: any[] = []): Promise<any[]> {
    return await this.db.query(sql, params);
  }

  public async close() {
    await this.db.close();
  }

  // Repository methods
  public async createOrder(order: SwapOrder): Promise<void> {
    const sql = `
      INSERT INTO orders (
        id, sender, recipient, source_chain, dest_chain, source_asset, dest_asset,
        amount, dest_amount, hashlock, secret, timelock, status, tx_hash_source,
        tx_hash_dest, tx_hash_claim, resolver_address, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.db.query(sql, [
      order.id, order.sender, order.recipient, order.sourceChain, order.destChain,
      order.sourceAsset, order.destAsset, order.amount, order.destAmount, order.hashlock,
      order.secret || null, order.timelock, order.status, order.txHashSource || null,
      order.txHashDest || null, order.txHashClaim || null, order.resolverAddress, order.createdAt
    ]);
  }

  public async getOrder(id: string): Promise<SwapOrder | null> {
    const rows = await this.db.query('SELECT * FROM orders WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    return this.mapRowToOrder(rows[0]);
  }

  public async getOrders(): Promise<SwapOrder[]> {
    const rows = await this.db.query('SELECT * FROM orders ORDER BY created_at DESC');
    return rows.map(this.mapRowToOrder);
  }

  public async updateOrderStatus(id: string, status: string, txHashField?: string, txHashValue?: string): Promise<void> {
    let sql = 'UPDATE orders SET status = ?';
    const params = [status];
    if (txHashField && txHashValue) {
      sql += `, ${txHashField} = ?`;
      params.push(txHashValue);
    }
    sql += ' WHERE id = ?';
    params.push(id);
    await this.db.query(sql, params);
  }

  public async storeSecret(hashlock: string, secret: string): Promise<void> {
    await this.db.query(
      'INSERT INTO secrets (hashlock, secret, revealed_at) VALUES (?, ?, ?) ON CONFLICT(hashlock) DO NOTHING',
      [hashlock, secret, Math.floor(Date.now() / 1000)]
    );
  }

  public async getSecret(hashlock: string): Promise<string | null> {
    const rows = await this.db.query('SELECT secret FROM secrets WHERE hashlock = ?', [hashlock]);
    if (rows.length === 0) return null;
    return rows[0].secret;
  }

  private mapRowToOrder(row: any): SwapOrder {
    return {
      id: row.id,
      sender: row.sender,
      recipient: row.recipient,
      sourceChain: row.source_chain,
      destChain: row.dest_chain,
      sourceAsset: row.source_asset,
      destAsset: row.dest_asset,
      amount: row.amount,
      destAmount: row.dest_amount,
      hashlock: row.hashlock,
      secret: row.secret || undefined,
      timelock: Number(row.timelock),
      status: row.status,
      txHashSource: row.tx_hash_source || undefined,
      txHashDest: row.tx_hash_dest || undefined,
      txHashClaim: row.tx_hash_claim || undefined,
      resolverAddress: row.resolver_address,
      createdAt: Number(row.created_at)
    };
  }
}
