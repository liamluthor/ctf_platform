# Email Setup Guide

The platform supports two email providers: **SMTP** and **AWS SES**.

## SMTP Configuration

Use SMTP for local development or when using services like Postfix, SendGrid, Mailgun, etc.

### Local Postfix (Production)

```bash
# Install Postfix
sudo apt-get install postfix

# Configure as send-only
sudo postconf -e "inet_interfaces = loopback-only"
sudo postconf -e "mydestination = localhost"
sudo systemctl restart postfix

# .env configuration
EMAIL_PROVIDER=smtp
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_SECURE=false
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=CTF Platform
```

### External SMTP (SendGrid, Mailgun, etc.)

```bash
# .env configuration
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=CTF Platform
```

## AWS SES Configuration

AWS Simple Email Service (SES) is recommended for production deployments on AWS.

### Prerequisites

1. **Verify your domain in SES**
   - Go to AWS SES Console → Verified identities
   - Add your domain (e.g., `yourdomain.com`)
   - Add the required DNS records (DKIM, SPF, etc.)

2. **Move out of sandbox mode**
   - New SES accounts start in sandbox mode (limited to verified emails)
   - Request production access: AWS SES Console → Account dashboard → Request production access

3. **IAM Permissions** (choose one)

   **Option A: IAM Role (Recommended for EC2)**
   - Attach policy to EC2 instance role:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "ses:SendEmail",
           "ses:SendRawEmail"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

   **Option B: Access Keys**
   - Create IAM user with `ses:SendEmail` and `ses:SendRawEmail` permissions
   - Generate access keys

### Configuration

#### Using IAM Role (EC2 Instances)

```bash
# .env configuration
EMAIL_PROVIDER=ses
AWS_REGION=us-east-1
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=CTF Platform

# No need for AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
# The SDK will automatically use the EC2 instance role
```

#### Using Access Keys

```bash
# .env configuration
EMAIL_PROVIDER=ses
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=CTF Platform
```

### Testing SES

```bash
# Test sending email
curl -X POST http://localhost:5000/api/account/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"your-verified-email@example.com"}'

# Check application logs
journalctl -u ctf-platform -f | grep "Email service"

# Check SES sending statistics
aws ses get-send-statistics --region us-east-1
```

## DNS Configuration

For best email deliverability, configure these DNS records:

### SPF Record (Required)

```
Type: TXT
Name: @
Value: v=spf1 include:amazonses.com ~all
```

Or for SMTP:
```
Type: TXT
Name: @
Value: v=spf1 a mx ~all
```

### DKIM Records (Recommended)

AWS SES provides DKIM records when you verify your domain. Add all three CNAME records provided.

### DMARC Record (Recommended)

```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com
```

## Troubleshooting

### Emails Not Sending

1. **Check logs**
   ```bash
   journalctl -u ctf-platform -n 100 | grep email
   ```

2. **Verify EMAIL_PROVIDER is set**
   ```bash
   grep EMAIL_PROVIDER /srv/ctf-platform/.env
   ```

3. **For SES: Check if in sandbox mode**
   ```bash
   aws ses get-account-sending-enabled --region us-east-1
   ```

4. **For SES: Verify sender email**
   ```bash
   aws ses list-verified-email-addresses --region us-east-1
   ```

### SES Rate Limits

- Sandbox: 200 emails/day, 1 email/second
- Production: Varies by account (request increase if needed)

Check your limits:
```bash
aws ses get-send-quota --region us-east-1
```

### SMTP Connection Refused

```bash
# Test SMTP connectivity
telnet localhost 25

# Check if Postfix is running
systemctl status postfix

# Check Postfix logs
tail -f /var/log/mail.log
```

## Switching Providers

To switch from SMTP to SES (or vice versa):

1. Update `.env` file
2. Restart the application
3. Test email delivery

```bash
# Update .env
vim /srv/ctf-platform/.env

# Restart
sudo systemctl restart ctf-platform

# Verify in logs
journalctl -u ctf-platform -n 10 | grep "Email service initialized"
```

## Email Templates

Email templates are defined in `server/services/email.ts`:

- **Email Verification**: Sent when user registers
- **Password Reset**: Sent when user requests password reset
- **Email Change Verification**: Sent when user changes email

To customize templates, edit the HTML in the respective functions.

## Security Best Practices

1. **Never commit credentials to git**
   - Use environment variables
   - Add `.env` to `.gitignore`

2. **Use IAM roles when possible**
   - Preferred over access keys
   - Automatically rotated by AWS

3. **Limit SES permissions**
   - Only grant `ses:SendEmail` and `ses:SendRawEmail`
   - Don't use root credentials

4. **Monitor email sending**
   - Set up CloudWatch alarms for SES
   - Monitor bounce and complaint rates

5. **Verify SPF/DKIM/DMARC**
   - Use tools like [MXToolbox](https://mxtoolbox.com/)
   - Test email deliverability

## Cost Comparison

### AWS SES
- **Pricing**: $0.10 per 1,000 emails
- **Free Tier**: 62,000 emails/month (when sending from EC2)
- **Pros**: Scalable, reliable, AWS integration
- **Cons**: Requires AWS account, sandbox restrictions

### SMTP (Postfix)
- **Pricing**: Free (server costs only)
- **Pros**: No external dependencies, full control
- **Cons**: Requires email reputation management, can be flagged as spam

### Third-Party SMTP (SendGrid, Mailgun)
- **Pricing**: Varies (typically $15-80/month)
- **Free Tier**: Usually 100-300 emails/day
- **Pros**: Managed deliverability, analytics
- **Cons**: Monthly cost, rate limits

## Recommended Setup

- **Development**: SMTP with local Postfix
- **Production (AWS)**: AWS SES with IAM role
- **Production (Non-AWS)**: Third-party SMTP (SendGrid/Mailgun)
