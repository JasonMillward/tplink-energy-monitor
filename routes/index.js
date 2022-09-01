const express = require('express')
const router = express.Router()

const deviceManager = require('../services/device-manager')

router.get('/', function (req, res, next) {
  const devices = sortDevices(deviceManager.getAllDevices())

  if (devices && devices.length > 0) {
    res.redirect('/overview')
  } else {
    res.render('index', {})
  }
})

router.get('/overview', function (req, res, next) {
  res.render('overview', {
    device: { deviceId: 'overview', alias: 'Overview' },
    devices: sortDevices(deviceManager.getAllDevices()).map(function (device) {
      return {
        deviceId: device.deviceId,
        alias: device.alias
      }
    })
  })
})

router.get('/:deviceId', function (req, res, next) {
  const deviceId = req.params.deviceId

  res.render('index', {
    device: deviceManager.getDevice(deviceId),
    devices: sortDevices(deviceManager.getAllDevices())
  })
})

function sortDevices (devices) {
  return devices.slice().sort((a, b) => {
    return a.alias.toLowerCase().localeCompare(b.alias.toLowerCase())
  })
}

module.exports = router
