import { companyName } from "../lib/globalType";

interface MessageTemplateProps {
  type: "success" | "rejected";
  email: string;
  subject: string;
  message: string;
}

const sendTemplateMail = ({
  type,
  email,
  subject,
  message,
}: MessageTemplateProps): string => {
  const color = type === "success" ? "#10B981" : "#EF4444"; // green for approved, red for rejected
  const emoji = type === "success" ? "✅" : "❌";

  return `
  <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f5; padding: 20px;">
    <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      
      <header style="background-color: ${color}; padding: 20px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 24px;">${companyName}</h1>
        <p style="margin: 5px 0 0; font-size: 16px;">${emoji} ${subject}</p>
      </header>

      <section style="padding: 20px; color: #111827; font-size: 15px; line-height: 1.6;">
        <p>Hello,</p>
        <p>${message}</p>

        
      </section>

      <footer style="padding: 15px 20px; text-align: center; font-size: 13px; color: #6b7280; background-color: #f4f4f5;">
  &copy; 2025 <strong>${companyName}</strong>. All rights reserved.
</footer>;

    </div>
  </div>
  `;
};

export default sendTemplateMail;
// <div style="margin-top: 20px; padding: 15px; background-color: #f9fafb; border-left: 5px solid ${color}; border-radius: 6px;">
//   <strong>Sender Email:</strong> ${email}
// </div>;
