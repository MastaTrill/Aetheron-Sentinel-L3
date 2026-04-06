/**
 * @title PriceOracle Formal Verification Spec
 * @notice Certora Prover specifications for PriceOracle.sol
 *
 * @specification Language: Certora Verification Language (CVL)
 * @author Aetheron Security Team
 * @version 1.0
 */

// =============================================================================
// IMPORTS
// =============================================================================

// =============================================================================
// CONSTANTS (matching Solidity contract)
// =============================================================================

definition ORACLE_ROLE() = keccak256("ORACLE_ROLE");
definition ADMIN_ROLE() = 0x00; // DEFAULT_ADMIN_ROLE
definition MAX_PRICE_DEVIATION() = 500; // 5% in basis points

// =============================================================================
// METHODS BLOCK
// =============================================================================

methods {
    getPrice(address) returns (uint256) envfree
    setPrice(address, uint256) => NONDET
    getPrices(address[]) returns (uint256[]) envfree
    hasRole(bytes32, address) returns (bool)
}

// =============================================================================
// INVARIANTS
// =============================================================================

/**
 * @notice INVARIANT: Prices are positive
 */
invariant positivePrices()
    forall address token. getPrice(token) > 0

// =============================================================================
// RULES
// =============================================================================

/**
 * @notice RULE: Only oracle can set prices
 */
rule onlyOracleCanSetPrices() {
    env e;
    require !hasRole(ORACLE_ROLE, e.msg.sender);

    address token;
    uint256 oldPrice = getPrice(token);

    setPrice@withrevert(e, token, 100);

    assert lastRevert || getPrice(token) == oldPrice;
}

/**
 * @notice RULE: Price updates are reasonable
 */
rule priceUpdatesReasonable() {
    env e;
    address token;
    uint256 oldPrice = getPrice(token);
    uint256 newPrice;

    setPrice(e, token, newPrice);

    // Price shouldn't change by more than max deviation
    assert newPrice >= oldPrice * (10000 - MAX_PRICE_DEVIATION()) / 10000 &&
           newPrice <= oldPrice * (10000 + MAX_PRICE_DEVIATION()) / 10000;
}

/**
 * @notice RULE: Get prices matches individual calls
 */
rule getPricesMatchesIndividual() {
    address[] tokens;
    uint256[] prices = getPrices(tokens);

    for (uint256 i = 0; i < tokens.length; i++) {
        assert prices[i] == getPrice(tokens[i]);
    }
}

// =============================================================================
// END OF SPEC
// =============================================================================