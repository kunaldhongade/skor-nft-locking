export type Skorstaking = {
  "version": "0.1.0",
  "name": "skorstaking",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "stakeMint",
          "type": "publicKey"
        },
        {
          "name": "monthlyCap",
          "type": "u64"
        }
      ]
    },
    {
      "name": "stakeTokens",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "stakeCounter",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "stakeAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vaultTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "rewardsTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "duration",
          "type": {
            "defined": "StakingDuration"
          }
        }
      ]
    },
    {
      "name": "claimRewards",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "stakeAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vaultTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "rewardsTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "setPauseStaking",
      "accounts": [
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "paused",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setMonthlyCap",
      "accounts": [
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "newMonthlyCap",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "publicKey"
          },
          {
            "name": "stakeMint",
            "type": "publicKey"
          },
          {
            "name": "monthlyCap",
            "type": "u64"
          },
          {
            "name": "pausedStaking",
            "type": "bool"
          },
          {
            "name": "monthlyDistributed",
            "type": "u64"
          },
          {
            "name": "lastEpochStart",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "stakeAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "staker",
            "type": "publicKey"
          },
          {
            "name": "depositAmount",
            "type": "u64"
          },
          {
            "name": "rewardAmount",
            "type": "u64"
          },
          {
            "name": "startTime",
            "type": "i64"
          },
          {
            "name": "duration",
            "type": "i64"
          },
          {
            "name": "claimed",
            "type": "bool"
          },
          {
            "name": "tier",
            "type": {
              "defined": "Tier"
            }
          },
          {
            "name": "index",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "stakeCounter",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "count",
            "type": "u64"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "StakingDuration",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Sixty"
          },
          {
            "name": "Ninety"
          },
          {
            "name": "OneEighty"
          },
          {
            "name": "ThreeSixtyFive"
          }
        ]
      }
    },
    {
      "name": "Tier",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Bronze"
          },
          {
            "name": "Silver"
          },
          {
            "name": "Gold"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "StakingPaused",
      "msg": "Staking is paused"
    },
    {
      "code": 6001,
      "name": "UnauthorizedToken",
      "msg": "Unauthorized token"
    },
    {
      "code": 6002,
      "name": "BelowMinimum",
      "msg": "Stake below minimum"
    },
    {
      "code": 6003,
      "name": "Overflow",
      "msg": "Overflow error"
    },
    {
      "code": 6004,
      "name": "InvalidDuration",
      "msg": "Invalid duration"
    },
    {
      "code": 6005,
      "name": "AlreadyClaimed",
      "msg": "Already claimed"
    },
    {
      "code": 6006,
      "name": "StillLocked",
      "msg": "Still locked"
    },
    {
      "code": 6007,
      "name": "Unauthorized",
      "msg": "Unauthorized action"
    },
    {
      "code": 6008,
      "name": "InvalidVaultOwner",
      "msg": "Invalid vault owner"
    },
    {
      "code": 6009,
      "name": "MonthlyCapReached",
      "msg": "Monthly cap reached, Try After some Time"
    },
    {
      "code": 6010,
      "name": "InsufficientTokenBalance",
      "msg": "Insufficient User Token Balance"
    },
    {
      "code": 6011,
      "name": "InsufficientRewards",
      "msg": "Insufficient reward pool"
    },
    {
      "code": 6012,
      "name": "InvalidMint",
      "msg": "Invalid mint account"
    },
    {
      "code": 6013,
      "name": "AlreadyInitialized",
      "msg": "Program has Already Initialized"
    },
    {
      "code": 6014,
      "name": "InvalidDecimals",
      "msg": "Program only supports 6 decimals"
    }
  ]
};

export const IDL: Skorstaking = {
  "version": "0.1.0",
  "name": "skorstaking",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "stakeMint",
          "type": "publicKey"
        },
        {
          "name": "monthlyCap",
          "type": "u64"
        }
      ]
    },
    {
      "name": "stakeTokens",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "stakeCounter",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "stakeAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vaultTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "rewardsTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "duration",
          "type": {
            "defined": "StakingDuration"
          }
        }
      ]
    },
    {
      "name": "claimRewards",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "stakeAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vaultTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "rewardsTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "setPauseStaking",
      "accounts": [
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "paused",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setMonthlyCap",
      "accounts": [
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "newMonthlyCap",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "publicKey"
          },
          {
            "name": "stakeMint",
            "type": "publicKey"
          },
          {
            "name": "monthlyCap",
            "type": "u64"
          },
          {
            "name": "pausedStaking",
            "type": "bool"
          },
          {
            "name": "monthlyDistributed",
            "type": "u64"
          },
          {
            "name": "lastEpochStart",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "stakeAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "staker",
            "type": "publicKey"
          },
          {
            "name": "depositAmount",
            "type": "u64"
          },
          {
            "name": "rewardAmount",
            "type": "u64"
          },
          {
            "name": "startTime",
            "type": "i64"
          },
          {
            "name": "duration",
            "type": "i64"
          },
          {
            "name": "claimed",
            "type": "bool"
          },
          {
            "name": "tier",
            "type": {
              "defined": "Tier"
            }
          },
          {
            "name": "index",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "stakeCounter",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "count",
            "type": "u64"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "StakingDuration",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Sixty"
          },
          {
            "name": "Ninety"
          },
          {
            "name": "OneEighty"
          },
          {
            "name": "ThreeSixtyFive"
          }
        ]
      }
    },
    {
      "name": "Tier",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Bronze"
          },
          {
            "name": "Silver"
          },
          {
            "name": "Gold"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "StakingPaused",
      "msg": "Staking is paused"
    },
    {
      "code": 6001,
      "name": "UnauthorizedToken",
      "msg": "Unauthorized token"
    },
    {
      "code": 6002,
      "name": "BelowMinimum",
      "msg": "Stake below minimum"
    },
    {
      "code": 6003,
      "name": "Overflow",
      "msg": "Overflow error"
    },
    {
      "code": 6004,
      "name": "InvalidDuration",
      "msg": "Invalid duration"
    },
    {
      "code": 6005,
      "name": "AlreadyClaimed",
      "msg": "Already claimed"
    },
    {
      "code": 6006,
      "name": "StillLocked",
      "msg": "Still locked"
    },
    {
      "code": 6007,
      "name": "Unauthorized",
      "msg": "Unauthorized action"
    },
    {
      "code": 6008,
      "name": "InvalidVaultOwner",
      "msg": "Invalid vault owner"
    },
    {
      "code": 6009,
      "name": "MonthlyCapReached",
      "msg": "Monthly cap reached, Try After some Time"
    },
    {
      "code": 6010,
      "name": "InsufficientTokenBalance",
      "msg": "Insufficient User Token Balance"
    },
    {
      "code": 6011,
      "name": "InsufficientRewards",
      "msg": "Insufficient reward pool"
    },
    {
      "code": 6012,
      "name": "InvalidMint",
      "msg": "Invalid mint account"
    },
    {
      "code": 6013,
      "name": "AlreadyInitialized",
      "msg": "Program has Already Initialized"
    },
    {
      "code": 6014,
      "name": "InvalidDecimals",
      "msg": "Program only supports 6 decimals"
    }
  ]
};
