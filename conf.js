"use strict";
const path = require('path');
require('dotenv').config({ path: path.dirname(process.mainModule.paths[0]) + '/.env' });

exports.bServeAsHub = false;
exports.bLight = true;

exports.bNoPassphrase = true;

exports.discord_token = process.env.discord_token;
exports.discord_channels = [process.env.channel];

exports.hub = process.env.testnet ? 'obyte.org/bb-test' : 'obyte.org/bb';
exports.explorer_base_url = process.env.testnet ? 'https://testnetexplorer.obyte.org/#' : 'https://explorer.obyte.org/#';
exports.oswap_base_url = process.env.testnet ? 'https://testnet-governance.oswap.io/' : 'https://governance.oswap.io/';

exports.governance_base_AAs = [
  'QQJXAEYSZU76EPDALIRNUFFTWMKGADHV'
];

exports.token_registry_AA_address = process.env.token_registry_AA_address;

console.log('finished server conf');
