const DAG = require('aabot/dag.js');
const conf = require('ocore/conf.js');
const network = require('ocore/network.js');
const eventBus = require('ocore/event_bus.js');
const lightWallet = require('ocore/light_wallet.js');
const walletGeneral = require('ocore/wallet_general.js');
const governanceEvents = require('governance_events/governance_events.js');
const governanceDiscord = require('governance_events/governance_discord.js');

var assocGovernanceAAs = {};
var assocPoolAAs = {};

lightWallet.setLightVendorHost(conf.hub);

eventBus.once('connected', function (ws) {
  network.initWitnessesIfNecessary(ws, start);
});

async function start() {
  await discoverGovernanceAas();
  eventBus.on('connected', function (ws) {
    conf.governance_base_AAs
      .forEach((address) => {
        network.addLightWatchedAa(address, null, console.log);
      });
  });
  lightWallet.refreshLightClientHistory();
  setInterval(discoverGovernanceAas, 24 * 3600 * 1000); // everyday check
}

eventBus.on('aa_response', async function (objResponse) {
  if (objResponse.response.error)
    return console.log('ignored response with error: ' + objResponse.response.error);
  if ((Math.ceil(Date.now() / 1000) - objResponse.timestamp) / 60 / 60 > 24)
    return console.log('ignored old response' + objResponse);
  if (assocGovernanceAAs[objResponse.aa_address]) {
    const governance_aa = assocGovernanceAAs[objResponse.aa_address];
    const main_aa = assocPoolAAs[governance_aa.main_aa];

    const event = await governanceEvents.treatResponseFromGovernanceAA(objResponse, main_aa.asset);

    const aa_name = main_aa.aa_address + ' (' + governance_aa.x_symbol + '-' + governance_aa.y_symbol + ')';
    governanceDiscord.announceEvent(aa_name, main_aa.symbol, main_aa.decimals, conf.oswap_base_url + "#" + main_aa.aa_address, event);
  }
});

async function discoverGovernanceAas() {
  rows = await DAG.getAAsByBaseAAs(conf.governance_base_AAs);
  await Promise.all(rows.map(indexAndWatchGovernanceAA));
}

async function indexAndWatchGovernanceAA(governanceAA) {
  return new Promise(async function (resolve) {
    const governanceParams = governanceAA.definition[1].params;
    const mainAAAddress = governanceParams.pool_aa;
    const mainAADefinition = await DAG.readAADefinition(mainAAAddress);

    const x_asset = mainAADefinition[1].params.x_asset;
    const y_asset = mainAADefinition[1].params.y_asset;

    const x_symbol = await getSymbolByAsset(x_asset);
    const y_symbol = await getSymbolByAsset(y_asset);

    await indexAllPoolAaParams(mainAAAddress);

    assocGovernanceAAs[governanceAA.address] = {
      main_aa: mainAAAddress,
      x_symbol,
      y_symbol
    }

    walletGeneral.addWatchedAddress(governanceAA.address, resolve);
  });
}

async function indexAllPoolAaParams(mainAAAddress) {
  const lp_shares = await DAG.readAAStateVar(mainAAAddress, "lp_shares");
  const governance_aa = await DAG.readAAStateVar(mainAAAddress, "governance_aa");

  const asset = lp_shares && lp_shares.asset;

  if (!asset || !governance_aa) return null;

  const decimals = await getDecimalsByAsset(asset);
  const symbol = await getSymbolByAsset(asset);

  assocPoolAAs[mainAAAddress] = {
    aa_address: mainAAAddress,
    governance_aa: governance_aa,
    asset: asset,
    decimals,
    symbol
  }
}

function handleJustsaying(ws, subject, body) {
  switch (subject) {
    case 'light/have_updates':
      lightWallet.refreshLightClientHistory();
      break;
  }
}


async function getDecimalsByAsset(asset) {
  if (asset === "base") return 9;

  const current_desc = await DAG.readAAStateVar(conf.token_registry_AA_address, 'current_desc_' + asset);
  if (!current_desc) return 0;

  const decimals = await DAG.readAAStateVar(conf.token_registry_AA_address, 'decimals_' + current_desc);

  return decimals || 0;
}

async function getSymbolByAsset(asset) {
  if (asset === "base") return "GBYTE";

  const symbol = await DAG.readAAStateVar(conf.token_registry_AA_address, 'a2s_' + asset);

  if (!symbol) return asset.replace(/[+=]/, '').substr(0, 6);

  return symbol
}

eventBus.on("message_for_light", handleJustsaying);

process.on('unhandledRejection', up => { throw up });