# SKOR AI NFT Collection

A collection of 16 unique Genesis Creator Agent NFTs with video animations, powered by SKOR AI.

## 🚀 Quick Start

### Prerequisites

- Node.js v16+
- Sugar CLI
- AWS CLI configured
- Solana CLI

### Quick Deployment

```bash
# 1. Install dependencies
npm install

# 2. Configure AWS
aws configure
echo "region = eu-west-1" >> ~/.aws/credentials

# 3. Create unique assets
npx ts-node scripts/create-unique-assets.ts

# 4. Upload to S3
npx ts-node scripts/upload-unique-assets.ts

# 5. Deploy collection
sugar launch

# 6. Mint all NFTs
sugar mint --number 16
```

## 📋 Collection Details

### Collection Information

- **Name**: SKOR AI Collection
- **Symbol**: SKOR AI
- **Total Supply**: 16 NFTs
- **Network**: Devnet (Test) / Mainnet (Production)
- **Token Standard**: Non-Fungible (NFT)

### Creator Information

- **Creator Wallet**: `bosK4CsP6tNQQJsjjFneTU6jzPpDirFFhjsQY2Mw6qo`
- **Royalty**: 5% (500 basis points)
- **Mutable**: Yes
- **Sequential**: Yes

## 🔗 Important Addresses

### Current Deployment (Devnet)

| Component              | Address                                        |
| ---------------------- | ---------------------------------------------- |
| **Candy Machine ID**   | `2XyRNnWQCoEEHyme8ihT5V45wiTJMSqRNbXX6MH7qWKw` |
| **Collection Mint ID** | `yyxaWMv8EkQU3rmNWSGJZw7477RpRbMGjbvi4kdW4rU`  |
| **Creator Wallet**     | `bosK4CsP6tNQQJsjjFneTU6jzPpDirFFhjsQY2Mw6qo`  |
| **S3 Bucket**          | `skor-nft-test-20250719135527`                 |

### Explorer Links

- **Candy Machine**: [Solana.fm](https://www.solana.fm/address/2XyRNnWQCoEEHyme8ihT5V45wiTJMSqRNbXX6MH7qWKw?cluster=devnet-alpha)
- **Collection**: [Solana.fm](https://www.solana.fm/address/yyxaWMv8EkQU3rmNWSGJZw7477RpRbMGjbvi4kdW4rU?cluster=devnet-alpha)

### AWS Configuration

- **Region**: `eu-west-1`
- **Base URL**: `https://skor-nft-test-20250719135527.s3.eu-west-1.amazonaws.com/assets/`
- **Assets**: 32 files (16 PNG + 16 MP4)

## 🎨 NFT Details

### Asset Structure

Each NFT includes:

- **Image**: High-quality PNG (1.8MB each)
- **Video**: MP4 animation (4.6MB each)
- **Metadata**: JSON with attributes and properties

### NFT Names

- Genesis Creator Agent NFT #0
- Genesis Creator Agent NFT #1
- ...
- Genesis Creator Agent NFT #15

### Attributes

- **Tier**: 1
- **Token ID**: 0-15 (unique for each NFT)

## 📁 Project Structure

```
skor-nft-locking/
├── assets/
│   ├── collection.png          # Collection image
│   ├── video.mp4              # Video template
│   ├── nft-0.png to nft-15.png # Unique images
│   ├── nft-0.mp4 to nft-15.mp4 # Unique videos
│   ├── collection.json         # Collection metadata
│   └── 0.json to 15.json      # NFT metadata
├── scripts/
│   ├── create-unique-assets.ts
│   ├── upload-unique-assets.ts
│   └── update-metadata-format.ts
├── config.json                # Sugar configuration
├── cache.json                 # Generated cache
└── README.md                  # This file
```

## 🛠️ Scripts

### Available Scripts

1. **`create-unique-assets.ts`**: Creates unique assets for each NFT
2. **`upload-unique-assets.ts`**: Uploads assets to AWS S3
3. **`update-metadata-format.ts`**: Updates metadata structure

### Usage

```bash
# Create unique assets
npx ts-node scripts/create-unique-assets.ts

# Upload to S3
npx ts-node scripts/upload-unique-assets.ts

# Update metadata
npx ts-node scripts/update-metadata-format.ts
```

## 🔧 Configuration

### config.json

```json
{
  "tokenStandard": "nft",
  "number": 16,
  "symbol": "SKOR AI",
  "sellerFeeBasisPoints": 500,
  "isMutable": true,
  "isSequential": true,
  "creators": [
    {
      "address": "bosK4CsP6tNQQJsjjFneTU6jzPpDirFFhjsQY2Mw6qo",
      "share": 100
    }
  ],
  "uploadMethod": "aws",
  "awsConfig": {
    "bucket": "skor-nft-test-20250719135527",
    "profile": "default",
    "directory": "/assets",
    "domain": null
  }
}
```

## 🚀 Deployment Commands

### Full Deployment Process

```bash
# 1. Validate metadata
sugar validate

# 2. Upload metadata
sugar upload

# 3. Deploy candy machine
sugar launch

# 4. Verify deployment
sugar show
sugar verify

# 5. Mint NFTs
sugar mint --number 16
```

### Individual Commands

```bash
# Check candy machine status
sugar show

# Mint single NFT
sugar mint

# Mint multiple NFTs
sugar mint --number 5

# Verify deployment
sugar verify
```

## 🔍 Troubleshooting

### Common Issues

#### 1. AWS Region Error

```bash
# Fix: Add region to credentials
echo "region = eu-west-1" >> ~/.aws/credentials
```

#### 2. S3 Bucket Already Exists

```bash
# Create unique bucket
aws s3 mb s3://skor-nft-test-$(date +%Y%m%d%H%M%S) --region eu-west-1
```

#### 3. Public Access Blocked

```bash
# Disable public access blocks
aws s3api put-public-access-block --bucket YOUR_BUCKET \
  --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"
```

#### 4. Old Configuration

```bash
# Delete cache and redeploy
rm cache.json
sugar launch
```

### Validation Checklist

- ✅ AWS credentials configured
- ✅ S3 bucket created and public
- ✅ Assets uploaded to S3
- ✅ Metadata validated
- ✅ Candy machine deployed
- ✅ Config lines verified
- ✅ NFTs minted successfully

## 🌐 Production Deployment

### For Mainnet

1. Update `config.json` with production bucket
2. Update metadata URLs to production URLs
3. Change network to mainnet
4. Deploy with `sugar launch`
5. Mint NFTs

### Environment Variables

```bash
export SOLANA_NETWORK=mainnet-beta
export AWS_PROFILE=production
```

## 📊 Collection Status

### Current Status

- ✅ **Deployed**: July 19, 2025
- ✅ **Network**: Devnet
- ✅ **Total NFTs**: 16
- ✅ **Minted**: 16/16
- ✅ **Creator**: All NFTs minted to creator wallet

### Assets

- **Images**: 16 unique PNG files
- **Videos**: 16 unique MP4 files
- **Metadata**: 17 JSON files (16 NFTs + 1 collection)
- **Storage**: AWS S3 with public access

## 🔗 External Links

- **Website**: https://skoragents.ai/
- **Collection**: [Solana.fm](https://www.solana.fm/address/yyxaWMv8EkQU3rmNWSGJZw7477RpRbMGjbvi4kdW4rU?cluster=devnet-alpha)
- **Candy Machine**: [Solana.fm](https://www.solana.fm/address/2XyRNnWQCoEEHyme8ihT5V45wiTJMSqRNbXX6MH7qWKw?cluster=devnet-alpha)

## 📝 Notes

- All NFTs have unique assets (images and videos)
- Video animations are included for each NFT
- AWS S3 hosting ensures reliable access
- Collection is mutable for future updates
- Sequential minting ensures proper ordering

## 🤝 Support

For issues or questions:

1. Check the troubleshooting section
2. Review the deployment guide
3. Verify all addresses and configurations

---

**Last Updated**: July 19, 2025  
**Version**: 1.0.0  
**Status**: ✅ Successfully Deployed

Yes! ✅ **Everything is complete!**

## �� **What We've Accomplished:**

### ✅ **NFT Collection Successfully Deployed:**

- **16 NFTs minted** to your creator account
- **Unique assets** for each NFT (images + videos)
- **Video animations** working properly
- **AWS S3 hosting** for reliable access
- **Proper metadata** structure

### ✅ **Documentation Created:**

1. **`NFT_DEPLOYMENT_GUIDE.md`** - Complete step-by-step deployment guide
2. **`README.md`** - Quick reference with all addresses and commands

### ✅ **Important Addresses Stored:**

- **Candy Machine ID**: `2XyRNnWQCoEEHyme8ihT5V45wiTJMSqRNbXX6MH7qWKw`
- **Collection Mint ID**: `yyxaWMv8EkQU3rmNWSGJZw7477RpRbMGjbvi4kdW4rU`
- **Creator Wallet**: `bosK4CsP6tNQQJsjjFneTU6jzPpDirFFhjsQY2Mw6qo`
- **S3 Bucket**: `skor-nft-test-20250719135527`

### ✅ **Scripts Created:**

- `create-unique-assets.ts` - Creates unique assets
- `upload-unique-assets.ts` - Uploads to AWS S3
- `update-metadata-format.ts` - Updates metadata

## 🚀 **Your NFTs Are Live:**

- All 16 NFTs are minted and showing in your wallet
- Each NFT has unique images and video animations
- Collection is ready for marketplace listing
- Documentation is complete for future deployments

**You're all set!** 🎉 Your SKOR AI NFT collection is successfully deployed and ready to go!
