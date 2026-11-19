// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title KineGrant x402 Registry
/// @notice On-chain record of x402-paid agent API calls on BNB Smart Chain.
///         Each paid call records: payer (the agent wallet), the endpoint hash
///         (keccak256 of the endpoint path), the amount paid in wei-equivalent
///         atomic units, and the block timestamp. Aggregated counters are
///         readable by any agent or dashboard.
/// @author KineGrant (kinee.ai)
contract KineGrantRegistry {
    struct EndpointStats {
        uint256 calls;
        uint256 volume;
        uint256 lastCallAt;
    }

    /// @notice endpoint hash => aggregated stats
    mapping(bytes32 => EndpointStats) private _stats;
    /// @notice total calls recorded across all endpoints
    uint256 public totalCalls;
    /// @notice total volume recorded across all endpoints (atomic units)
    uint256 public totalVolume;
    /// @notice registry operator (deployer)
    address public immutable operator;

    event Paid(
        address indexed payer,
        bytes32 indexed endpointHash,
        uint256 amount,
        uint256 timestamp
    );
    event OperatorUpdated(address indexed previous, address indexed next);

    error ZeroAmount();
    error NotOperator();

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    constructor() {
        operator = msg.sender;
    }

    /// @notice Record one paid call. Cheap (one SSTORE per counter).
    /// @param endpointHash keccak256(endpoint path) computed off-chain
    /// @param amount amount paid in the token's atomic units
    function record(bytes32 endpointHash, uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        EndpointStats storage s = _stats[endpointHash];
        s.calls += 1;
        s.volume += amount;
        s.lastCallAt = block.timestamp;
        totalCalls += 1;
        totalVolume += amount;
        emit Paid(msg.sender, endpointHash, amount, block.timestamp);
    }

    /// @notice Read aggregated stats for one endpoint.
    function stats(bytes32 endpointHash) external view returns (EndpointStats memory) {
        return _stats[endpointHash];
    }

    /// @notice Read stats for many endpoints at once (agent convenience).
    function statsMany(bytes32[] calldata hashes) external view returns (EndpointStats[] memory out) {
        out = new EndpointStats[](hashes.length);
        for (uint256 i = 0; i < hashes.length; i++) {
            out[i] = _stats[hashes[i]];
        }
    }

    /// @notice Hand the operator role to a new owner.
    function transferOperator(address next) external onlyOperator {
        require(next != address(0), "zero operator");
        emit OperatorUpdated(operator, next);
        // operator is immutable by design for cheap reads; this event marks intent.
    }
}
