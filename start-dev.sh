#!/bin/bash

# Create tmux session named 'ra-prod'
tmux new-session -d -s ra-prod

# Split vertically (left and right panes)
tmux split-window -h

# Split the right pane horizontally (top and bottom)
tmux select-pane -t 1
tmux split-window -v

# Left pane: RAG server
tmux select-pane -t 0
tmux send-keys 'cd ~/ra-prod/rag' C-m
tmux send-keys 'source venv/bin/activate' C-m
tmux send-keys 'pip install -r requirements.txt' C-m
tmux send-keys 'python app.py' C-m

# Right top pane: Auth server
tmux select-pane -t 1
tmux send-keys 'cd ~/ra-prod/auth-server' C-m
tmux send-keys 'source venv/bin/activate' C-m
tmux send-keys 'pip install -r requirements.txt' C-m
tmux send-keys 'python app.py' C-m

# Right bottom pane: Quill directory
tmux select-pane -t 2
tmux send-keys 'cd ~/ra-prod/quill' C-m

# Attach to the session
tmux attach-session -t ra-prod