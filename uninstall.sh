#!/bin/bash
set -euo pipefail

# OpenAEON Uninstaller for macOS and Linux
# Usage: curl -fsSL https://raw.githubusercontent.com/gu2003li/OpenAEON/main/uninstall.sh | bash

BOLD='\033[1m'
ACCENT='\033[38;2;255;77;77m'
SUCCESS='\033[38;2;0;229;204m'
WARN='\033[38;2;255;176;32m'
ERROR='\033[38;2;230;57;70m'
NC='\033[0m'

ui_info() { echo -e "${BOLD}·${NC} $*"; }
ui_success() { echo -e "${SUCCESS}✓${NC} $*"; }
ui_warn() { echo -e "${WARN}!${NC} $*"; }
ui_error() { echo -e "${ERROR}✗${NC} $*"; }

echo -e "${ACCENT}${BOLD}"
echo "  🦞 OpenAEON Uninstaller"
echo -e "${NC}"

# 1. Stop and Uninstall Gateway Service
if command -v openaeon &> /dev/null; then
    ui_info "Stopping and uninstalling OpenAEON gateway service..."
    openaeon gateway stop &>/dev/null || true
    openaeon gateway uninstall --force &>/dev/null || true
    ui_success "Gateway service removed."
fi

# 2. Remove Global NPM Package
if command -v npm &> /dev/null; then
    ui_info "Removing global openaeon package..."
    npm uninstall -g openaeon &>/dev/null || true
    ui_success "NPM package uninstalled."
fi

# 3. Remove Local Binaries
BIN_FILE="$HOME/.local/bin/openaeon"
if [[ -L "$BIN_FILE" || -f "$BIN_FILE" ]]; then
    ui_info "Removing local binary at $BIN_FILE..."
    rm -f "$BIN_FILE"
    ui_success "Binary removed."
fi

# 4. Remove Configuration (Optional/Confirm)
# By default, we keep the data to prevent accidental loss, but provide instructions.
CONFIG_FILE="$HOME/.openaeon.json"
DATA_DIR="$HOME/.openaeon"

echo ""
ui_warn "Configuration and session data were NOT removed automatically."
echo "To completely wipe all data, manually run:"
echo -e "  ${BOLD}rm -f $CONFIG_FILE${NC}"
echo -e "  ${BOLD}rm -rf $DATA_DIR${NC}"
echo -e "  ${BOLD}rm -rf $HOME/.clawdbot $HOME/.moltbot $HOME/.moldbot${NC}"
echo ""

ui_success "OpenAEON has been uninstalled. Convergence reached. 🎯"