#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Bytes, BytesN, Env, Val};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum OrderStatus {
    None = 0,
    Locked = 1,
    Claimed = 2,
    Refunded = 3,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Order {
    pub sender: Address,
    pub recipient: Address,
    pub amount: i128,
    pub hashlock: BytesN<32>,
    pub timelock: u64,
    pub status: OrderStatus,
}

#[contract]
pub struct HTLCEscrowContract;

#[contractimpl]
impl HTLCEscrowContract {
    pub fn init(env: Env, token: Address) {
        if env.storage().instance().has(&DataKey::Token) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Token, &token);
    }

    pub fn lock(
        env: Env,
        order_id: Bytes,
        recipient: Address,
        hashlock: BytesN<32>,
        timelock: u64,
        amount: i128,
    ) {
        assert!(!env.storage().instance().has(&DataKey::Order(order_id.clone())), "Order ID already exists");
        assert!(amount > 0, "Amount must be greater than zero");
        assert!(timelock > env.ledger().timestamp(), "Timelock must be in the future");

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let client = token::Client::new(&env, &token_addr);

        let sender = env.clone().ledger().timestamp().to_val(); // dummy check or authenticate sender:
        // Authentic sender can be verified:
        // We get caller identity
        let caller = env.storage().instance().get(&DataKey::Token).unwrap(); // fallback or authenticate msg.sender:
        // In Soroban, the standard way is: caller calls and we transfer from them:
        // We require authentication of sender (we can pass sender as parameter and require auth)
        // Let's pass sender as parameter or read from contract args
    }

    pub fn lock_order(
        env: Env,
        sender: Address,
        order_id: Bytes,
        recipient: Address,
        hashlock: BytesN<32>,
        timelock: u64,
        amount: i128,
    ) {
        sender.require_auth();
        assert!(!env.storage().instance().has(&DataKey::Order(order_id.clone())), "Order ID already exists");
        assert!(amount > 0, "Amount must be greater than zero");
        assert!(timelock > env.ledger().timestamp(), "Timelock must be in the future");

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let client = token::Client::new(&env, &token_addr);

        client.transfer(&sender, &env.current_contract_address(), &amount);

        let order = Order {
            sender,
            recipient,
            amount,
            hashlock,
            timelock,
            status: OrderStatus::Locked,
        };

        env.storage().instance().set(&DataKey::Order(order_id), &order);
    }

    pub fn claim(env: Env, order_id: Bytes, secret: BytesN<32>) {
        let mut order: Order = env
            .storage()
            .instance()
            .get(&DataKey::Order(order_id.clone()))
            .expect("Order not found");

        assert!(order.status == OrderStatus::Locked, "Order is not locked");

        // Verify hashlock
        let hash = env.crypto().sha256(&secret.into());
        assert_eq!(hash, order.hashlock, "Invalid secret preimage");

        order.status = OrderStatus.Claimed;

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let client = token::Client::new(&env, &token_addr);

        client.transfer(&env.current_contract_address(), &order.recipient, &order.amount);

        env.storage().instance().set(&DataKey::Order(order_id), &order);
    }

    pub fn refund(env: Env, order_id: Bytes) {
        let mut order: Order = env
            .storage()
            .instance()
            .get(&DataKey::Order(order_id.clone()))
            .expect("Order not found");

        assert!(order.status == OrderStatus::Locked, "Order is not locked");
        assert!(env.ledger().timestamp() >= order.timelock, "Timelock has not expired");

        order.status = OrderStatus.Refunded;

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let client = token::Client::new(&env, &token_addr);

        client.transfer(&env.current_contract_address(), &order.sender, &order.amount);

        env.storage().instance().set(&DataKey::Order(order_id), &order);
    }

    pub fn get_order(env: Env, order_id: Bytes) -> Option<Order> {
        env.storage().instance().get(&DataKey::Order(order_id))
    }
}

#[contracttype]
enum DataKey {
    Token,
    Order(Bytes),
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, Ledger}, Env};

    #[test]
    fn test_htlc_lifecycle() {
        let env = Env::default();
        env.mock_all_auths();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);

        // Deploy token
        let token_admin = Address::generate(&env);
        let token_contract_id = env.register_stellar_asset_contract(token_admin.clone());
        let token_client = token::Client::new(&env, &token_contract_id);

        token_client.mint(&sender, &1000);

        // Deploy HTLC
        let htlc_id = env.register_contract(None, HTLCEscrowContract);
        let htlc_client = HTLCEscrowContractClient::new(&env, &htlc_id);

        // Init
        htlc_client.init(&token_contract_id);

        // Prepare order details
        let order_id = Bytes::from_slice(&env, b"order_id_1");
        let secret = BytesN::from_array(&env, &[7; 32]);
        let hashlock = env.crypto().sha256(&secret.clone().into());
        let timelock = 1000;

        env.ledger().set_timestamp(100);

        // Lock
        htlc_client.lock_order(&sender, &order_id, &recipient, &hashlock, &timelock, &500);

        assert_eq!(token_client.balance(&sender), 500);
        assert_eq!(token_client.balance(&htlc_id), 500);

        let order = htlc_client.get_order(&order_id).unwrap();
        assert_eq!(order.amount, 500);
        assert_eq!(order.status, OrderStatus::Locked);

        // Claim with bad secret fails
        let bad_secret = BytesN::from_array(&env, &[9; 32]);
        let res = env.as_contract(&htlc_id, || {
            let res = std::panic::catch_unwind(|| {
                htlc_client.claim(&order_id, &bad_secret);
            });
            assert!(res.is_err());
        });

        // Claim with correct secret succeeds
        htlc_client.claim(&order_id, &secret);
        assert_eq!(token_client.balance(&recipient), 500);
        assert_eq!(token_client.balance(&htlc_id), 0);

        let order = htlc_client.get_order(&order_id).unwrap();
        assert_eq!(order.status, OrderStatus::Claimed);
    }

    #[test]
    fn test_htlc_refund() {
        let env = Env::default();
        env.mock_all_auths();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);

        let token_admin = Address::generate(&env);
        let token_contract_id = env.register_stellar_asset_contract(token_admin.clone());
        let token_client = token::Client::new(&env, &token_contract_id);

        token_client.mint(&sender, &1000);

        let htlc_id = env.register_contract(None, HTLCEscrowContract);
        let htlc_client = HTLCEscrowContractClient::new(&env, &htlc_id);
        htlc_client.init(&token_contract_id);

        let order_id = Bytes::from_slice(&env, b"order_id_2");
        let secret = BytesN::from_array(&env, &[7; 32]);
        let hashlock = env.crypto().sha256(&secret.clone().into());
        let timelock = 1000;

        env.ledger().set_timestamp(100);

        htlc_client.lock_order(&sender, &order_id, &recipient, &hashlock, &timelock, &500);

        // Refund fails before timelock
        env.ledger().set_timestamp(500);
        env.as_contract(&htlc_id, || {
            let res = std::panic::catch_unwind(|| {
                htlc_client.refund(&order_id);
            });
            assert!(res.is_err());
        });

        // Refund succeeds after timelock
        env.ledger().set_timestamp(1001);
        htlc_client.refund(&order_id);

        assert_eq!(token_client.balance(&sender), 1000);
        assert_eq!(token_client.balance(&htlc_id), 0);

        let order = htlc_client.get_order(&order_id).unwrap();
        assert_eq!(order.status, OrderStatus::Refunded);
    }
}
