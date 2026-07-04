import { Persistence } from '../persistence';

export class SecretService {
  private persistence: Persistence;

  constructor(persistence: Persistence) {
    this.persistence = persistence;
  }

  public async registerSecret(hashlock: string, secret: string): Promise<void> {
    const cleanHashlock = hashlock.toLowerCase().replace(/^0x/, '');
    const cleanSecret = secret.toLowerCase().replace(/^0x/, '');
    
    await this.persistence.storeSecret(cleanHashlock, cleanSecret);
  }

  public async getSecret(hashlock: string): Promise<string | null> {
    const cleanHashlock = hashlock.toLowerCase().replace(/^0x/, '');
    return await this.persistence.getSecret(cleanHashlock);
  }
}
