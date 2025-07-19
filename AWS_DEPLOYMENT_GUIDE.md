# AWS Deployment Guide for SKOR NFT Collection

## Overview

This guide will help you deploy your SKOR NFT collection to AWS S3 for production use. The collection has been updated to use AWS S3 for image hosting and external metadata URLs for video content.

## Prerequisites

### 1. AWS CLI Installation

```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Verify installation
aws --version
```

### 2. AWS Credentials Setup

```bash
# Configure AWS credentials
aws configure

# Enter the following information:
# AWS Access Key ID: [Your Access Key]
# AWS Secret Access Key: [Your Secret Key]
# Default region name: eu-west-1
# Default output format: json
```

### 3. S3 Bucket Creation

```bash
# Create the S3 bucket for metadata
aws s3 mb s3://skor-metadata --region eu-west-1

# Enable public read access (for NFT images)
aws s3api put-bucket-policy --bucket skor-metadata --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::skor-metadata/*"
    }
  ]
}'
```

## Configuration Changes Made

### 1. Updated `config.json`

- Changed `uploadMethod` from "bundlr" to "aws"
- Added AWS S3 configuration
- Updated creator address and collection details
- Set `tokenStandard` to "nft"
- Increased collection size to 1111 NFTs

### 2. Updated Metadata Format

All NFT metadata files now include:

- AWS S3 URLs for images: `https://skor-metadata.s3.eu-west-1.amazonaws.com/assets/{id}.png`
- External video URLs: `https://metadata.skoragents.ai/assets/{id}.mp4`
- Proper `properties` structure with `files` array
- External URL: `https://skoragents.ai/`
- Animation URL for video content

## Deployment Process

### 1. Upload Assets to S3

```bash
# Run the deployment script
npx ts-node scripts/deploy-to-aws.ts
```

This script will:

- Check AWS credentials
- Verify S3 bucket exists
- Upload all PNG files to S3
- Deploy with Sugar CLI

### 2. Manual Upload (Alternative)

```bash
# Upload all PNG files to S3
aws s3 cp assets/ s3://skor-metadata/assets/ --recursive --exclude "*.json" --acl public-read
```

### 3. Deploy with Sugar CLI

```bash
# Upload metadata
sugar upload

# Deploy candy machine
sugar deploy
```

## Metadata Structure

### Collection Metadata (`assets/collection.json`)

```json
{
  "name": "Genesis Creator Agent NFT Collection",
  "symbol": "SKOR AI",
  "description": "Powered by SKOR AI - A collection of Genesis Creator Agent NFTs",
  "seller_fee_basis_points": 500,
  "image": "https://skor-metadata.s3.eu-west-1.amazonaws.com/assets/collection.png",
  "external_url": "https://skoragents.ai/",
  "properties": {
    "files": [
      {
        "uri": "https://skor-metadata.s3.eu-west-1.amazonaws.com/assets/collection.png",
        "type": "image/png"
      }
    ],
    "category": "image",
    "creators": [
      {
        "address": "8C4LnpU7gaUdeyvrUkRqkjRCE7xFjTLkVss1UFiPRmXw",
        "share": 100
      }
    ]
  }
}
```

### Individual NFT Metadata

```json
{
  "name": "Genesis Creator Agent NFT #0",
  "symbol": "SKOR AI",
  "description": "Powered by SKOR AI",
  "seller_fee_basis_points": 500,
  "image": "https://skor-metadata.s3.eu-west-1.amazonaws.com/assets/0.png",
  "animation_url": "https://metadata.skoragents.ai/assets/0.mp4",
  "external_url": "https://skoragents.ai/",
  "attributes": [
    {
      "trait_type": "Tier",
      "value": "1"
    }
  ],
  "properties": {
    "files": [
      {
        "uri": "https://metadata.skoragents.ai/assets/0.mp4",
        "type": "video/mp4"
      },
      {
        "uri": "https://skor-metadata.s3.eu-west-1.amazonaws.com/assets/0.png",
        "type": "image/png"
      }
    ],
    "category": "video",
    "creators": [
      {
        "address": "8C4LnpU7gaUdeyvrUkRqkjRCE7xFjTLkVss1UFiPRmXw",
        "share": 100
      }
    ]
  }
}
```

## Important Notes

### 1. Video Content

- Video files should be uploaded to `metadata.skoragents.ai`
- This is separate from the S3 bucket for images
- Videos are referenced via `animation_url` and `properties.files`

### 2. Creator Address

- Updated to: `8C4LnpU7gaUdeyvrUkRqkjRCE7xFjTLkVss1UFiPRmXw`
- This should be your production wallet address

### 3. Collection Size

- Set to 1111 NFTs for production
- Sequential minting enabled

### 4. AWS Costs

- S3 storage costs apply for image hosting
- Consider setting up CloudFront for better performance
- Monitor usage to optimize costs

## Troubleshooting

### Common Issues

1. **AWS Credentials Error**

   ```bash
   # Reconfigure AWS credentials
   aws configure
   ```

2. **S3 Bucket Access Denied**

   ```bash
   # Check bucket permissions
   aws s3api get-bucket-policy --bucket skor-metadata
   ```

3. **Sugar CLI Errors**

   ```bash
   # Verify Sugar installation
   sugar --version

   # Check configuration
   sugar validate
   ```

### Support

For issues with:

- AWS setup: Check AWS documentation
- Sugar CLI: Check Metaplex documentation
- NFT metadata: Verify JSON structure

## Next Steps

1. **Test Deployment**

   - Deploy to devnet first
   - Mint a test NFT
   - Verify metadata on marketplaces

2. **Production Deployment**

   - Deploy to mainnet
   - Update creator address if needed
   - Monitor deployment

3. **Post-Deployment**
   - Set up monitoring
   - Configure analytics
   - Plan marketing launch
