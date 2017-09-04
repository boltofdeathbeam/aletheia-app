const config = require('config')

const request = require('request-promise-native')
const view = require('./credit-account-view')
const Web3ClientFactory = require('../common/web3/web3-client-factory')

// todo: throw error if app is clearly misconfigured.
const web3ClientPromise = Web3ClientFactory.getDefaultInstance()

web3ClientPromise.then((web3Client) => {
  new CreditAccountController({
    web3Client,
    view
  })
}).catch((err) => {
  console.error(err, err.stack)
  view.showEthereumError('Error initialising blockchain')
})

class CreditAccountController {
  constructor ({web3Client, view}) {
    this._web3Client = web3Client
    this._view = view
    this.balance = 0
    this.account = ''
    this.faucetCookie = ''

    this._view.on('submitCreditRequest', this.onSubmitCreditRequest.bind(this))
    this._web3Client.on('balance-update', this.onBalanceUpdate.bind(this))
    this._web3Client.createAccountIfNotExist().then((accountHash) => {
      this.account = accountHash
      this._view.showEthereumAccount({accountHash})
    }).catch((e) => {
      console.error(e, e.stack)
      this.account = ''
      this._view.showEthereumAccount('')
    })
    this.loadCaptcha()
  }

  onWeb3PeerUpdate (err, numPeers) {
    if (err) {
      this._view.showEthereumError(`Error conecting to alethia blockchian node at: ${config.get('web3.url')}`)
    } else if (numPeers === 0) {
      this._view.showEthereumError('No alethia blockchain peers found')
    } else if (numPeers > 0) {
      this._view.setEthereumPeers(numPeers)
    }
  }

  onBalanceUpdate (err, balance) {
    if (err || !balance) {
      this._view.showEthereumBalance(`Error getting balance`)
    } else {
      this._view.showEthereumBalance({balance})
    }
  }

  loadCaptcha () {
    request({
      method: 'GET',
      url: `${config.get('faucet.url')}/captcha.svg`,
      jar: true // save session id cookie
    }).then((result) => {
      this._view.setCaptcha(result)
    })
  }

  onSubmitCreditRequest () {
    const captcha = this._view.getCaptchaAnswer()
    const requestArgs = {
      receiver: this.account,
      captcha: captcha
    }
    console.log(requestArgs)
    request({
      method: 'POST',
      url: config.get('faucet.url'),
      jar: true, // use session id cookie
      json: requestArgs
    })
      .then((result) => { console.log(result) })
      .catch((err) => { console.error(err) })
  }
}
