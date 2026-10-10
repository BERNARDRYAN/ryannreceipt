// Minimal typings for the parts of Google Identity Services we use.
// https://developers.google.com/identity/gsi/web/reference/js-reference

declare namespace google.accounts.id {
  type CredentialResponse = {
    credential: string;
    select_by?: string;
  };

  type IdConfiguration = {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    nonce?: string;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: "signin" | "signup" | "use";
    ux_mode?: "popup" | "redirect";
    itp_support?: boolean;
    use_fedcm_for_prompt?: boolean;
    use_fedcm_for_button?: boolean;
  };

  type GsiButtonConfiguration = {
    type?: "standard" | "icon";
    theme?: "outline" | "filled_blue" | "filled_black";
    size?: "large" | "medium" | "small";
    text?: "signin_with" | "signup_with" | "continue_with" | "signin";
    shape?: "rectangular" | "pill" | "circle" | "square";
    logo_alignment?: "left" | "center";
    width?: number;
    locale?: string;
  };

  function initialize(config: IdConfiguration): void;
  function renderButton(parent: HTMLElement, options: GsiButtonConfiguration): void;
  function disableAutoSelect(): void;
  function cancel(): void;
  function prompt(): void;
}

interface Window {
  google?: { accounts: { id: typeof google.accounts.id } };
}
