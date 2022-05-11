#!/bin/bash

websocat -t - autoreconnect:ws://127.0.0.1:$1/app/app-key -v --ping-interval=15
