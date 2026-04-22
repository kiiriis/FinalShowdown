export const DEFAULT_CONNECTION_TEMPLATE =
  "Hi, I'm a CS Master's student at Stony Brook, very interested in {companyName} and the recent {jobRole} role. I believe I'm a great fit and would truly appreciate your help and any guidance you can share. Would love to connect—thanks so much! – {userName}";

export const DEFAULT_REFERRAL_TEMPLATE = `Hello,

I hope you're doing well! I came across a {jobRole} role at {companyName} and felt it closely aligns with my background and interests. I'd be truly grateful if you could refer me — a referral from someone like you would really help strengthen my chances.

Please let me know if you'd be open to it.

Email : {userEmail}
Job Link : {jobLink}

Thanks so much,
{userName}`;

export const TEMPLATE_PLACEHOLDERS: Array<{
  token: string;
  description: string;
}> = [
  { token: "{companyName}", description: "The company posting the job" },
  { token: "{jobRole}", description: "The position title" },
  { token: "{jobLink}", description: "Link to the job posting" },
  { token: "{userName}", description: "Your display name" },
  { token: "{userEmail}", description: "Your Google sign-in email" },
];

export type TemplateKind = "connection" | "referral";

export function getDefaultTemplate(kind: TemplateKind): string {
  return kind === "connection"
    ? DEFAULT_CONNECTION_TEMPLATE
    : DEFAULT_REFERRAL_TEMPLATE;
}

export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match,
  );
}
