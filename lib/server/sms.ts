/**
 * Outgoing SMS behind one interface, so a real gateway (e.g. a Mongolian SMS provider)
 * can be dropped in later without touching callers.
 *
 * For now: a stub that prints the message to the server console. Never use it in
 * production with real customers — set SMS_PROVIDER once a gateway is wired up.
 */
export interface SmsSender {
  send(phone: string, message: string): Promise<void>;
}

class ConsoleSms implements SmsSender {
  async send(phone: string, message: string): Promise<void> {
    console.log(`[sms:stub] → ${phone}: ${message}`);
  }
}

let sender: SmsSender | null = null;

export function sms(): SmsSender {
  // Future: switch (process.env.SMS_PROVIDER) { case "…": return new RealGateway(); }
  sender ??= new ConsoleSms();
  return sender;
}
