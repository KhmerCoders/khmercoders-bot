# KhmerCoders Bot

A comprehensive community management bot for the Khmer Coders community, supporting both Telegram and Discord platforms. This bot tracks member activity, generates leaderboards, provides analytics, and includes a web dashboard for community insights.

## Features

### 🤖 Bot Commands (Telegram)

#### Public Commands
- `/leaderboard` - View the all-time top contributors
- `/daily` - View today's most active members
- `/weekly` - View this week's leaderboard
- `/monthly` - View this month's top contributors
- `/stats` - View your personal statistics
- `/help` - Display available commands

#### Admin Commands
- `/admin stats` - View detailed server statistics
- `/admin cleanup` - Clean up old data and optimize database
- `/admin help` - View admin-specific commands

### 📊 Web Dashboard
- Real-time community statistics
- Interactive leaderboards with filtering
- Activity trends and analytics
- Responsive design for all devices
- Accessible at your deployed worker URL

### 🛡️ Security Features
- Rate limiting to prevent spam
- Input sanitization and validation
- Admin privilege verification
- Abuse detection and prevention
- Secure webhook handling

### 📈 Analytics & Tracking
- Message count tracking across platforms
- User activity monitoring
- Platform-specific statistics
- Time-based leaderboards (daily, weekly, monthly)
- Community growth metrics

### 🔌 API Endpoints
- `/api/stats/:platform` - Platform statistics
- `/api/leaderboard/:platform/:period?` - Leaderboard data
- `/api/user/:platform/:userId` - Individual user stats
- `/api/overview` - Community overview
- `/api/health` - Service health check
- `/api/docs` - API documentation

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm or yarn package manager
- Cloudflare account (for deployment)
- Telegram Bot Token (from @BotFather)

### Quick Start

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/KhmerCoders/khmercoders-bot.git
   cd khmercoders-bot
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Environment Setup**:
   Create a `.dev.vars` file in the root directory:
   ```env
   TELEGRAM_BOT_TOKEN="YOUR_TELEGRAM_BOT_TOKEN_HERE"
   ```

4. **Database Setup**:
   ```bash
   npm run migrate:dev
   ```

5. **Start Development Server**:
   ```bash
   npm run dev
   ```

Your bot will be accessible at `http://localhost:8787` with the dashboard available at the root URL.

## Configuration

### Environment Variables

Create a `.dev.vars` file for local development:

```env
TELEGRAM_BOT_TOKEN="YOUR_TELEGRAM_BOT_TOKEN_HERE"
```

For production deployment, set these variables in your Cloudflare Worker settings:
- `TELEGRAM_BOT_TOKEN` - Your Telegram bot token from @BotFather

### Bot Permissions

Ensure your Telegram bot has the following permissions:
- Send messages
- Read messages in groups
- Access to group member information

## Deployment

### Development

```bash
npm run dev
```

### Production

1. **Deploy to Cloudflare Workers**:
   ```bash
   npm run deploy
   ```

2. **Set Production Environment Variables**:
   ```bash
   wrangler secret put TELEGRAM_BOT_TOKEN
   ```

3. **Run Production Migrations**:
   ```bash
   npm run migrate:prod
   ```

## Database Management

This project uses Cloudflare D1 for database storage with migrations in the `migrations/` directory.

### Migration Commands

- **Development**: `npm run migrate:dev`
- **Production**: `npm run migrate:prod`

### Database Schema

The bot tracks:
- User messages and activity
- Platform-specific data (Telegram/Discord)
- Message threading and channel information
- User statistics and rankings

## Telegram Bot Setup

### Creating Your Bot

1. **Contact @BotFather** on Telegram
2. **Use `/newbot`** and follow the prompts
3. **Save your bot token** - you'll need this for configuration
4. **Set bot commands** (optional):
   ```
   leaderboard - View all-time top contributors
   daily - View today's most active members
   weekly - View this week's leaderboard
   monthly - View this month's top contributors
   stats - View your personal statistics
   help - Display available commands
   ```

### Webhook Configuration

After deploying, set your webhook URL:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-worker-url.workers.dev/telegram/webhook"}'
```

Replace:
- `<YOUR_BOT_TOKEN>` with your actual bot token
- `your-worker-url.workers.dev` with your deployed worker URL

## Discord Integration

The bot supports Discord webhook integration for message tracking. Configure Discord webhooks to send data to `/discord/webhook` endpoint.

## API Usage

### Base URL
- Development: `http://localhost:8787`
- Production: `https://your-worker-url.workers.dev`

### Available Endpoints

#### Get Platform Statistics
```http
GET /api/stats/:platform
```

#### Get Leaderboard
```http
GET /api/leaderboard/:platform/:period?
```
- `period`: `daily`, `weekly`, `monthly` (optional, defaults to all-time)

#### Get User Statistics
```http
GET /api/user/:platform/:userId
```

#### Community Overview
```http
GET /api/overview
```

#### Health Check
```http
GET /api/health
```

#### API Documentation
```http
GET /api/docs
```

### Rate Limiting

API endpoints are rate-limited to prevent abuse:
- 100 requests per minute per IP
- Admin endpoints have stricter limits
- Rate limit headers included in responses

## Testing

### Local Webhook Testing

Test webhook functionality with sample data:

```bash
npm run test:webhook
```

This sends a sample Telegram message to your local development server.

### Manual Testing Commands

Test bot commands in your Telegram group:
- Send `/help` to see available commands
- Send `/leaderboard` to test leaderboard functionality
- Send `/stats` to test personal statistics
- Test admin commands (if you have admin privileges)

## Project Structure

```
khmercoders-bot/
├── src/
│   ├── index.ts              # Main worker entry point
│   ├── handlers/
│   │   └── telegramHandler.ts # Telegram webhook and command handling
│   ├── types/
│   │   ├── discord.ts        # Discord type definitions
│   │   └── telegram.ts       # Telegram type definitions
│   └── utils/
│       ├── db-helpers.ts     # Database operations
│       ├── security-helpers.ts # Security and rate limiting
│       ├── stats-helpers.ts  # Statistics and leaderboard logic
│       └── telegram-helpers.ts # Telegram API utilities
├── migrations/               # Database schema migrations
├── public/
│   └── index.html           # Web dashboard
├── test/
│   └── telegram-sample.json # Sample webhook data
├── package.json
├── tsconfig.json
├── wrangler.jsonc          # Cloudflare Worker configuration
└── README.md
```

## Security

The bot implements multiple security measures:

- **Rate Limiting**: Prevents spam and abuse
- **Input Sanitization**: Validates and sanitizes all user input
- **Admin Verification**: Restricts sensitive commands to authorized users
- **Abuse Detection**: Monitors for suspicious activity
- **Secure Headers**: Implements security best practices

## Monitoring & Analytics

### Web Dashboard Features
- Real-time activity monitoring
- Leaderboard visualizations
- Community growth trends
- Platform comparison metrics
- User engagement analytics

### Available Metrics
- Total messages tracked
- Active users count
- Platform distribution
- Daily/weekly/monthly activity
- Top contributors

## Troubleshooting

### Common Issues

1. **Bot not responding to commands**
   - Verify webhook URL is correctly set
   - Check bot token in environment variables
   - Ensure bot has proper permissions in the group

2. **Database connection errors**
   - Run migrations: `npm run migrate:dev`
   - Check Cloudflare D1 database configuration

3. **Rate limiting issues**
   - Wait for rate limit to reset
   - Check if your IP is being rate limited
   - Contact admin if needed

4. **Missing admin commands**
   - Verify admin privileges in the database
   - Check user ID configuration

### Debug Mode

Enable debug logging by setting the `DEBUG` environment variable:

```bash
DEBUG=1 npm run dev
```

## Contributing

We welcome contributions from the community! Here's how you can help:

### Development Workflow

1. **Fork the Repository**
   ```bash
   git fork https://github.com/KhmerCoders/khmercoders-bot.git
   ```

2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Your Changes**
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed

4. **Test Your Changes**
   ```bash
   npm run dev
   npm run test:webhook
   ```

5. **Submit a Pull Request**
   - Write clear commit messages
   - Include a detailed description of changes
   - Reference any related issues

### Development Guidelines

- **Code Style**: Use TypeScript with strict type checking
- **Testing**: Test all new features thoroughly
- **Documentation**: Update README and code comments
- **Security**: Follow security best practices
- **Performance**: Consider rate limiting and resource usage

### Reporting Issues

When reporting bugs, please include:
- Steps to reproduce the issue
- Expected vs actual behavior
- Environment details (OS, Node.js version, etc.)
- Error messages or logs

### Feature Requests

For new features, please:
- Check existing issues first
- Provide a clear use case
- Consider implementation complexity
- Discuss with maintainers before large changes

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/KhmerCoders/khmercoders-bot/issues)
- **Community**: Join our Telegram group for support and discussions
- **Documentation**: Check this README and inline code comments

## Acknowledgments

- Khmer Coders community for feedback and testing
- Cloudflare for Workers and D1 database platform
- Telegram Bot API for webhook functionality
- All contributors who helped improve this project

---

**Made with ❤️ by the Khmer Coders community**
