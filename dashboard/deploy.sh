#!/bin/sh

BUCKET=$1
PROFILE=$2

rm -rf node_modules jspm_packages
npm install

aws s3 sync . s3://$BUCKET --exclude "node_modules/*" --exclude ".git/*" --exclude ".DS_Store" --exclude ".gitignore" --profile $PROFILE
