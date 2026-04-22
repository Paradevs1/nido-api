import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    const gmailUser = process.env['GMAIL_USER'];
    const gmailPassword = process.env['GMAIL_PASSWORD'];

    if (!gmailUser || !gmailPassword) {
      throw new Error('GMAIL_USER and GMAIL_PASSWORD environment variables are required');
    }

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPassword
      }
    });
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    const mailOptions = {
      from: process.env['GMAIL_USER'],
      to: email,
      subject: 'Bounties - Email Verification Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .header {
              background-color: #00141e;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 0 0 5px 5px;
            }
            .code {
              font-size: 32px;
              font-weight: bold;
              text-align: center;
              letter-spacing: 8px;
              color: #00141e;
              padding: 20px;
              background-color: #f0f0f0;
              border-radius: 5px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Bounties - Email Verification</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>You requested email verification. Use the code below to complete the verification:</p>
              <div class="code">${code}</div>
              <p>This code expires in 10 minutes.</p>
              <p>If you did not request this verification, you can ignore this email.</p>
            </div>
            <div class="footer">
              <p>This is an automated email, please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send verification email');
    }
  }
}

