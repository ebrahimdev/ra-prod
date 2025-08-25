#!/bin/bash

echo "🐍 Installing Python 3.10 for better ML package compatibility"

# Add deadsnakes PPA for Python 3.10
apt-get update
apt-get install -y software-properties-common
add-apt-repository ppa:deadsnakes/ppa -y
apt-get update

# Install Python 3.10 and related packages
apt-get install -y python3.10 python3.10-venv python3.10-dev python3.10-distutils

# Verify installation
echo "✅ Python 3.10 installed:"
python3.10 --version

# Install pip for Python 3.10
curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
python3.10 get-pip.py
rm get-pip.py

echo "✅ Python 3.10 setup complete!"
echo "This should resolve PyTorch and ML package compatibility issues."