import { ChannelsStatusSnapshot } from "../types.ts";
import type { ChannelsState } from "./channels.types.ts";

export type { ChannelsState };

export async function loadChannels(state: ChannelsState, probe: boolean) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.channelsLoading) {
    return;
  }
  state.channelsLoading = true;
  state.channelsError = null;
  try {
    const res = await state.client.request<ChannelsStatusSnapshot | null>("channels.status", {
      probe,
      timeoutMs: 8000,
    });
    state.channelsSnapshot = res;
    state.channelsLastSuccess = Date.now();
  } catch (err) {
    state.channelsError = String(err);
  } finally {
    state.channelsLoading = false;
  }
}

export async function startWhatsAppLogin(state: ChannelsState, force: boolean) {
  if (!state.client || !state.connected || state.whatsappBusy) {
    return;
  }
  state.whatsappBusy = true;
  try {
    const res = await state.client.request<{ message?: string; qrDataUrl?: string }>(
      "web.login.start",
      {
        force,
        timeoutMs: 30000,
      },
    );
    state.whatsappLoginMessage = res.message ?? null;
    state.whatsappLoginQrDataUrl = res.qrDataUrl ?? null;
    state.whatsappLoginConnected = null;
  } catch (err) {
    state.whatsappLoginMessage = String(err);
    state.whatsappLoginQrDataUrl = null;
    state.whatsappLoginConnected = null;
  } finally {
    state.whatsappBusy = false;
  }
}

export async function waitWhatsAppLogin(state: ChannelsState) {
  if (!state.client || !state.connected || state.whatsappBusy) {
    return;
  }
  state.whatsappBusy = true;
  try {
    const res = await state.client.request<{ message?: string; connected?: boolean }>(
      "web.login.wait",
      {
        timeoutMs: 120000,
      },
    );
    state.whatsappLoginMessage = res.message ?? null;
    state.whatsappLoginConnected = res.connected ?? null;
    if (res.connected) {
      state.whatsappLoginQrDataUrl = null;
    }
  } catch (err) {
    state.whatsappLoginMessage = String(err);
    state.whatsappLoginConnected = null;
  } finally {
    state.whatsappBusy = false;
  }
}

export async function logoutWhatsApp(state: ChannelsState) {
  if (!state.client || !state.connected || state.whatsappBusy) {
    return;
  }
  state.whatsappBusy = true;
  try {
    await state.client.request("channels.logout", { channel: "whatsapp" });
    state.whatsappLoginMessage = "Logged out.";
    state.whatsappLoginQrDataUrl = null;
    state.whatsappLoginConnected = null;
  } catch (err) {
    state.whatsappLoginMessage = String(err);
  } finally {
    state.whatsappBusy = false;
  }
}

export async function startWeixinLogin(state: ChannelsState, force: boolean) {
  if (!state.client || !state.connected || state.weixinBusy) {
    return;
  }
  state.weixinBusy = true;
  try {
    const res = await state.client.request<{ message?: string; qrDataUrl?: string }>(
      "weixin.login.start",
      {
        force,
        timeoutMs: 30000,
      },
    );
    state.weixinLoginMessage = res.message ?? null;
    state.weixinLoginQrDataUrl = res.qrDataUrl ?? null;
    state.weixinLoginConnected = null;
  } catch (err) {
    state.weixinLoginMessage = String(err);
    state.weixinLoginQrDataUrl = null;
    state.weixinLoginConnected = null;
  } finally {
    state.weixinBusy = false;
  }
}

export async function waitWeixinLogin(state: ChannelsState) {
  if (!state.client || !state.connected || state.weixinBusy) {
    return;
  }
  state.weixinBusy = true;
  try {
    const res = await state.client.request<{ message?: string; connected?: boolean }>(
      "weixin.login.wait",
      {
        timeoutMs: 120000,
      },
    );
    state.weixinLoginMessage = res.message ?? null;
    state.weixinLoginConnected = res.connected ?? null;
    if (res.connected) {
      state.weixinLoginQrDataUrl = null;
    }
  } catch (err) {
    state.weixinLoginMessage = String(err);
    state.weixinLoginConnected = null;
  } finally {
    state.weixinBusy = false;
  }
}

export async function logoutWeixin(state: ChannelsState) {
  if (!state.client || !state.connected || state.weixinBusy) {
    return;
  }
  state.weixinBusy = true;
  try {
    await state.client.request("channels.logout", { channel: "tencent-weixin" });
    state.weixinLoginMessage = "Logged out.";
    state.weixinLoginQrDataUrl = null;
    state.weixinLoginConnected = null;
  } catch (err) {
    state.weixinLoginMessage = String(err);
  } finally {
    state.weixinBusy = false;
  }
}
