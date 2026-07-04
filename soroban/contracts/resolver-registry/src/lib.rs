#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Val};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ResolverInfo {
    pub staked_amount: i128,
    pub active: bool,
    pub active_swaps: u32,
}

#[contract]
pub struct ResolverRegistryContract;

#[contractimpl]
impl ResolverRegistryContract {
    pub fn init(env: Env, admin: Address, token: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
    }

    pub fn register(env: Env, resolver: Address, amount: i128) {
        resolver.require_auth();
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let client = token::Client::new(&env, &token_addr);

        // Transfer stake amount from resolver to this contract
        client.transfer(&resolver, &env.current_contract_address(), &amount);

        let mut info = Self::get_resolver(env.clone(), resolver.clone()).unwrap_or(ResolverInfo {
            staked_amount: 0,
            active: false,
            active_swaps: 0,
        });

        info.staked_amount += amount;
        info.active = true;

        env.storage().instance().set(&DataKey::Resolver(resolver), &info);
    }

    pub fn unregister(env: Env, resolver: Address) {
        resolver.require_auth();
        let mut info = Self::get_resolver(env.clone(), resolver.clone()).expect("Resolver not found");
        assert!(info.active, "Resolver already inactive");
        assert_eq!(info.active_swaps, 0, "Cannot unregister with active swaps");

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let client = token::Client::new(&env, &token_addr);

        let return_amount = info.staked_amount;
        info.staked_amount = 0;
        info.active = false;

        client.transfer(&env.current_contract_address(), &resolver, &return_amount);
        env.storage().instance().set(&DataKey::Resolver(resolver), &info);
    }

    pub fn slash(env: Env, resolver: Address, recipient: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let mut info = Self::get_resolver(env.clone(), resolver.clone()).expect("Resolver not found");
        assert!(info.staked_amount > 0, "Resolver has no stake to slash");

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let client = token::Client::new(&env, &token_addr);

        let slash_amount = info.staked_amount;
        info.staked_amount = 0;
        info.active = false;

        client.transfer(&env.current_contract_address(), &recipient, &slash_amount);
        env.storage().instance().set(&DataKey::Resolver(resolver), &info);
    }

    pub fn get_resolver(env: Env, resolver: Address) -> Option<ResolverInfo> {
        env.storage().instance().get(&DataKey::Resolver(resolver))
    }

    pub fn increment_swaps(env: Env, resolver: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let mut info = Self::get_resolver(env.clone(), resolver.clone()).expect("Resolver not found");
        assert!(info.active, "Resolver not active");
        info.active_swaps += 1;
        env.storage().instance().set(&DataKey::Resolver(resolver), &info);
    }

    pub fn decrement_swaps(env: Env, resolver: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let mut info = Self::get_resolver(env.clone(), resolver.clone()).expect("Resolver not found");
        assert!(info.active_swaps > 0, "No active swaps to decrement");
        info.active_swaps -= 1;
        env.storage().instance().set(&DataKey::Resolver(resolver), &info);
    }
}

#[contracttype]
enum DataKey {
    Admin,
    Token,
    Resolver(Address),
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_registry_lifecycle() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let resolver = Address::generate(&env);
        let recipient = Address::generate(&env);

        // Deploy token
        let token_admin = Address::generate(&env);
        let token_contract_id = env.register_stellar_asset_contract(token_admin.clone());
        let token_client = token::Client::new(&env, &token_contract_id);

        // Mint token to resolver
        token_client.mint(&resolver, &1000);

        // Deploy registry
        let registry_id = env.register_contract(None, ResolverRegistryContract);
        let registry_client = ResolverRegistryContractClient::new(&env, &registry_id);

        // Init registry
        registry_client.init(&admin, &token_contract_id);

        // Register
        registry_client.register(&resolver, &500);
        assert_eq!(token_client.balance(&resolver), 500);
        assert_eq!(token_client.balance(&registry_id), 500);

        let info = registry_client.get_resolver(&resolver).unwrap();
        assert_eq!(info.staked_amount, 500);
        assert!(info.active);

        // Increment active swaps
        registry_client.increment_swaps(&resolver);
        let info = registry_client.get_resolver(&resolver).unwrap();
        assert_eq!(info.active_swaps, 1);

        // Decrement swaps
        registry_client.decrement_swaps(&resolver);

        // Unregister
        registry_client.unregister(&resolver);
        assert_eq!(token_client.balance(&resolver), 1000);
        assert_eq!(token_client.balance(&registry_id), 0);

        // Slash
        token_client.mint(&resolver, &500);
        registry_client.register(&resolver, &500);
        registry_client.slash(&resolver, &recipient);
        assert_eq!(token_client.balance(&recipient), 500);
    }
}
