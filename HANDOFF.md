# Project Handoff & Deployment Guide

This guide provides step-by-step instructions for deploying and running the Conti-Newty Workbench locally or in production. **Note:** All `.env` secrets, AWS credentials, OAuth keys, and IAM permissions have been deliberately excluded from the codebase for security. You must provision these resources in your own environment.

---

## 1. Prerequisites
- Node.js 18+ LTS
- Docker (optional, for containerized deployment)
- AWS Account
- Google Cloud Account
- GitHub Account

## 2. Create the AWS S3 bucket
The application uploads workspace ZIP archives to this bucket and returns temporary presigned download URLs.

1. Open AWS Console.
2. Open S3.
3. Create a bucket, for example: `conti-newty-archives-your-name`
4. Choose the same region that will be used for Bedrock.
5. Keep **Block all public access** enabled. Do not enable public bucket access.

## 3. Enable Amazon Bedrock
1. Open Amazon Bedrock in AWS Console.
2. Select the intended AWS region (e.g. `eu-central-1`, `us-east-1`, `us-west-2`).
3. Bedrock models are now automatically enabled on first invocation! You no longer need to manually activate access.
4. **Note for Anthropic Models**: If you are a first-time user of Anthropic models on AWS, you may need to submit "use case details" when prompted by AWS before your first invocation succeeds.
   - The application currently uses: `anthropic.claude-haiku-4-5-20251001-v1:0`
   - Ensure your selected region supports this specific model in the Bedrock Model Catalog.
   - The model must be available in the selected region.

## 4. Create AWS permissions
Create an IAM user for local development, or use an IAM role in deployment.

**Minimum permissions:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      {
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/archives/*"
    }
  ]
}"
    }
  ]
}
```
*For production, restrict the Bedrock resource and S3 bucket permissions further.*
> ⚠️ **Never commit AWS keys to GitHub.**

## 5. Create the local `.env`
Copy the project’s environment template if one exists. Otherwise create `.env` in the project root.

Use:
```env
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
DATABASE_URL=file:./prisma/dev.db

JWT_SECRET=generate-a-long-random-secret

AI_PROVIDER=bedrock
AWS_REGION=your-aws-region
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
ARCHIVE_BUCKET=your-s3-bucket-name
```

For local development, AWS credentials can be supplied either through `.env` or the AWS CLI credential chain.

A safer alternative is:
```bash
aws configure
```
Then enter the AWS access key, secret, region, and output format. The AWS SDK will use those credentials automatically.

## 6. Add Google OAuth configuration
In Google Cloud Console:
1. Open or create a Google Cloud project.
2. Enable the OAuth consent screen.
3. Create an OAuth client ID.
4. Choose **Web application**.
5. Add this authorized redirect URI: `http://localhost:3000/api/auth/google/callback`
6. Add these values to `.env`:
```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## 7. Add GitHub OAuth configuration
In GitHub:
1. Open Settings.
2. Open Developer settings.
3. Open OAuth Apps.
4. Create or select an OAuth App.
5. Set the authorization callback URL to: `http://localhost:3000/api/auth/github/callback`
6. Add to `.env`:
```env
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

## 8. Prepare Prisma
From the project root:
```bash
npx prisma generate
npx prisma db push
```
For a fresh local database, this creates the schema used by:
- Users and organizations
- Workspaces
- AI tasks
- Provider credentials
- Proposed changes
- Connector records
- App deployments

## 9. Build the project
```bash
npm run build:backend
npm run build:web
```
*Both commands must complete successfully.*

## 10. Run the tests
```bash
npm test -- --runInBand
```
*Expected result from the current branch: 36 test suites passed, 176 tests passed.*

## 11. Start the application
```bash
npm run dev
```
Open: `http://localhost:3000`

Check the health endpoint:
```bash
curl http://localhost:3000/api/health
```
PowerShell:
```powershell
Invoke-RestMethod http://localhost:3000/api/health
```
Expected response:
```json
{
  "status": "ok",
  "provider": "bedrock",
  "archiveStorage": "s3"
}
```

## 12. Verify Google and GitHub login
Open the application and test:
1. Click **Continue with Google**.
2. Complete Google login.
3. Confirm the browser returns to the workspace.
4. Log out.
5. Click **Continue with GitHub**.
6. Complete GitHub login.
7. Confirm the browser returns to the workspace.

*If OAuth fails, check: Redirect URI spelling, Port number, `FRONTEND_URL`, OAuth client ID/secret, and whether the server is running on port 3000.*

## 13. Verify Bedrock
After logging in:
1. Create a workspace.
2. Add a Markdown file, for example `docs/product.md`.
3. Open the **Ask** page.
4. Ask a question about that file.
5. Confirm the answer is generated through Bedrock.
6. Confirm the answer contains source citations.

The production provider is selected by:
`AI_PROVIDER=bedrock`

If AWS credentials or Bedrock permissions are invalid, the application should return a clear provider configuration error instead of silently falling back to simulation.

## 14. Verify S3 archive export
1. Open a workspace.
2. Add files.
3. Open Archives.
4. Click export.
5. Confirm the request succeeds.
6. Confirm an archive object appears under: `archives/` in the S3 bucket.
7. Confirm the response contains a temporary presigned URL.
8. Open the URL and download the ZIP.
   - *The URL expires after approximately 15 minutes.*

## 15. Verify S3 archive import
1. Create or obtain a ZIP file.
2. Open the workspace archive import screen.
3. Upload the ZIP.
4. Confirm the files appear in the workspace.
5. Verify traversal protection by testing that unsafe paths such as `../secret.txt` are rejected.

## 16. Verify the app-generation workflow
1. Add workspace documents or JSON data.
2. Open **Software**.
3. Generate an application.
4. Confirm generated files are written.
5. Confirm the sandbox starts.
6. Open the returned application URL.
7. Verify the generated page loads.

## 17. Optional Docker deployment
After creating `.env`, run:
```bash
docker compose up --build
```
The container will:
- Run the Node backend
- Serve the compiled frontend
- Use Bedrock for production AI tasks
- Use S3 for workspace archives
- Expose port 3000
- Use `/api/health` for health checks

Open: `http://localhost:3000`

### Production Architecture Recommendation
For a cloud deployment, the preferred production setup is:
```text
Container service
        |
        | IAM role
        v
Amazon Bedrock

Container service
        |
        | IAM role
        v
Private Amazon S3 bucket
```
*The important handoff point is that your friend must create their own `.env`, AWS resources, OAuth credentials, and IAM permissions. Those secrets were deliberately not included in the pushed branch.*
