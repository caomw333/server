#!/bin/bash
cd server
git pull
npm install
screen -X -S server quit > /dev/null 2>&1
screen -dmS server npm start
