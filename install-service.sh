#!/usr/bin/env bash
set -euo pipefail

# Determine installation directory (where this script is located)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Rocket LED systemd service installer ==="
echo ""
echo "Installation directory: $SCRIPT_DIR"
echo ""

# Ask for the user to run the service as
read -p "User to run the service as [default: $USER]: " SERVICE_USER
SERVICE_USER="${SERVICE_USER:-$USER}"

# Check if the user is in the gpio group (required for GPIO access)
if ! groups "$SERVICE_USER" | grep -q '\bgpio\b'; then
    echo ""
    echo "WARNING: User '$SERVICE_USER' is not in the 'gpio' group."
    echo "GPIO access will fail. Add the user to the gpio group with:"
    echo "  sudo usermod -a -G gpio $SERVICE_USER"
    echo ""
    read -p "Continue anyway? [y/N]: " CONTINUE
    if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
fi

# Generate the service file from template
SERVICE_FILE="/tmp/rocket-led.service"
sed -e "s|{{INSTALL_DIR}}|$SCRIPT_DIR|g" \
    -e "s|{{USER}}|$SERVICE_USER|g" \
    "$SCRIPT_DIR/rocket-led.service" > "$SERVICE_FILE"

echo ""
echo "Generated service file:"
cat "$SERVICE_FILE"
echo ""

# Install the service
read -p "Install to /etc/systemd/system/rocket-led.service? [Y/n]: " INSTALL
INSTALL="${INSTALL:-Y}"
if [[ "$INSTALL" =~ ^[Yy]$ ]]; then
    sudo cp "$SERVICE_FILE" /etc/systemd/system/rocket-led.service
    sudo systemctl daemon-reload
    echo "✓ Service installed successfully"

    # Ask if user wants to enable and start
    read -p "Enable service to start on boot? [Y/n]: " ENABLE
    ENABLE="${ENABLE:-Y}"
    if [[ "$ENABLE" =~ ^[Yy]$ ]]; then
        sudo systemctl enable rocket-led.service
        echo "✓ Service enabled"
    fi

    read -p "Start service now? [Y/n]: " START
    START="${START:-Y}"
    if [[ "$START" =~ ^[Yy]$ ]]; then
        sudo systemctl start rocket-led.service
        echo "✓ Service started"
        echo ""
        echo "Check status with: sudo systemctl status rocket-led"
        echo "View logs with: sudo journalctl -u rocket-led -f"
    fi
else
    echo "Service file saved to: $SERVICE_FILE"
    echo "Install manually with: sudo cp $SERVICE_FILE /etc/systemd/system/rocket-led.service"
fi

rm -f "$SERVICE_FILE"
echo ""
echo "Done!"
