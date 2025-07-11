# KhmerCoders Bot

## Introduction

This is a bot designed for the Khmer Coders community, supporting both Telegram and Discord platforms. Its primary function is to track message counts for members within a group and generate leaderboards.

## Getting Started

### Prerequisites

Before running the bot, ensure you have Node.js and npm installed.

### Setup

1. **Clone the Repository**:

   ```bash
   git clone https://github.com/KhmerCoders/khmercoders-bot.git
   cd khmercoders-bot
   ```

2. **Install Dependencies**:

   ```bash
   npm install
   ```

### Configuration

**Create `.dev.vars`**:
In the root directory, create a file named `.dev.vars` with the following structure:

```
TELEGRAM_BOT_TOKEN="YOUR_TELEGRAM_BOT_TOKEN_HERE"
DEV_MODE=true
```

**Important**: Replace `YOUR_TELEGRAM_BOT_TOKEN_HERE` with the actual token you receive from BotFather (see "Telegram Bot Setup" below). This file is ignored by Git, so your token will not be committed to the repository.

### Running the Service

To start the bot locally:

```bash
npm run dev
```

This command starts the Cloudflare worker on your local machine, accessible at `http://localhost:8787`.

### Database Management

This project utilizes Cloudflare D1 for database storage, with the schema defined within the `migrations` directory.

#### Development Migrations

To apply migrations to your local development database:

```bash
npm run migrate:dev
```

#### Production Migrations

To apply migrations to the production database:

```bash
npm run migrate:prod
```

### Telegram Bot Setup

To integrate with Telegram:

1. **Create Your Bot**: Message [@BotFather](https://t.me/BotFather) on Telegram.
2. **Use `/newbot`**: Follow the prompts to create a new bot, choosing a name and username.
3. **Save Bot Token**: BotFather will provide you with a unique bot token. **Save this token**, as it's required for the `config.json` file.

#### Configuring the Webhook

After deploying your Cloudflare Worker, you must inform Telegram where to send updates. Set the webhook URL using the following command:

```bash
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-worker-url.workers.dev/telegram/webhook
```

**Remember to replace**:

- `<YOUR_BOT_TOKEN>` with your actual Telegram bot token.
- `https://your-worker-url.workers.dev/telegram/webhook` with the URL of your deployed Cloudflare Worker.

### Testing Webhook Locally

To test the webhook functionality with a sample Telegram message against your local development server:

```bash
npm run test:webhook
```

This will send a test message to your local webhook endpoint.

## Cloudflare AI Gateway Setup

This bot utilizes a Cloudflare AI Gateway named `khmercoders-bot-summary-gw` for specific AI functionalities. You will need to create this gateway in your Cloudflare account to ensure the bot operates correctly.

## Contribution Guidelines

We welcome contributions from the community! Please follow these steps:

1. **Fork the Repository**: Create your own copy of the repository.
2. **Create a New Branch**: Branch off from `main` or `master` for your new feature or bug fix.
3. **Implement Your Changes**: Write your code, ensuring it adheres to the existing project standards.
4. **Write/Update Tests**: Add or update tests to cover your changes.
5. **Submit a Pull Request**: Create a pull request to merge your changes back into the main repository.

### Development Standards

- **Code Style**: Adhere to the established code style and patterns within the project.
- **Documentation**: Add comments for complex logic to improve readability.
- **Maintainability**: Strive for clean, well-structured, and maintainable code.
- **Commit Messages**: Write clear and descriptive commit messages.

If you have any questions or suggestions, feel free to open an issue or reach out to the community!
