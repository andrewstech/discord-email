FROM node:latest

# Create the directory!
RUN mkdir -p /usr/src/bot
WORKDIR /usr/src/bot

# Copy and Install our bot
COPY package.json /usr/src/bot
RUN npm install

# For Debugging
#RUN apt-get update && apt-get install -y \
#    nano \
#    curl \
#    git \
#    && rm -rf /var/lib/apt/lists/*

# Our precious bot
COPY . /usr/src/bot

# Start me!
CMD ["node", "."]
