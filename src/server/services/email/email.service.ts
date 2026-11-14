export interface SendInvitationEmailParams {
  to: string;
  inviterEmail: string;
  listName: string;
  role: "EDITOR" | "VIEWER";
  invitationUrl: string;
}

export interface IEmailService {
  sendInvitationEmail(params: SendInvitationEmailParams): Promise<void>;
}

/**
 * ConsoleEmailService
 * Default implementation for development and testing.
 * Outputs invitation details and secure invitation links to server logs.
 */
export class ConsoleEmailService implements IEmailService {
  async sendInvitationEmail(params: SendInvitationEmailParams): Promise<void> {
    console.log("\n=======================================================");
    console.log("✉️  EMAIL DISPATCH: List Collaboration Invitation");
    console.log("=======================================================");
    console.log(`To:          ${params.to}`);
    console.log(`From:        ${params.inviterEmail}`);
    console.log(`List:        ${params.listName}`);
    console.log(`Role:        ${params.role}`);
    console.log(`Invite Link: ${params.invitationUrl}`);
    console.log("=======================================================\n");
  }
}

/**
 * ResendEmailService
 * Production implementation using Resend HTTP API.
 */
export class ResendEmailService implements IEmailService {
  private readonly apiKey: string;
  private readonly fromAddress: string;

  constructor(apiKey: string, fromAddress = "notifications@caizetodo.com") {
    this.apiKey = apiKey;
    this.fromAddress = fromAddress;
  }

  async sendInvitationEmail(params: SendInvitationEmailParams): Promise<void> {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: [params.to],
          subject: `${params.inviterEmail} invited you to collaborate on '${params.listName}'`,
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #111;">Collaborate on Caize Todo</h2>
              <p><strong>${params.inviterEmail}</strong> has invited you to collaborate on the list <strong>${params.listName}</strong> with <strong>${params.role}</strong> permissions.</p>
              <div style="margin: 28px 0;">
                <a href="${params.invitationUrl}" style="background-color: #111; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; display: inline-block;">
                  Accept Invitation
                </a>
              </div>
              <p style="font-size: 12px; color: #666;">Or copy and paste this link in your browser:<br/><a href="${params.invitationUrl}">${params.invitationUrl}</a></p>
            </div>
          `,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("Resend email dispatch error:", errorBody);
      }
    } catch (err) {
      console.error("Failed to deliver email via Resend:", err);
    }
  }
}

/**
 * Factory to retrieve appropriate email service based on environment.
 */
export function getEmailService(): IEmailService {
  const provider = process.env.EMAIL_PROVIDER || "console";
  const resendApiKey = process.env.RESEND_API_KEY;

  if (provider === "resend" && resendApiKey) {
    return new ResendEmailService(resendApiKey, process.env.EMAIL_FROM);
  }

  return new ConsoleEmailService();
}

export const emailService = getEmailService();

