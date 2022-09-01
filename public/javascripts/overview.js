const dash = {
  ws: null,

  deviceId: null,
  devices: [],

  realtimeTrendChart: null,
  realtimeTrendLastSample: 0,

  dailyUsageChart: null,
  monthlyUsageChart: null,
  usageLogChart: null,

  dailyGraphData: {},
  monthlyGraphData: {},

  dailyStats: {
    'total-day-kwh': [],
    'total-day-currency': [],
    '30-total-kwh': [],
    '30-total-currency': [],
    'avg-day-kwh': [],
    'avg-day-currency': []
  },

  monthlyStats: {
    'total-month-kwh': [],
    'total-month-currency': [],
    'avg-month': [],
    'months-total-kwh': [],
    'months-total-currency': []
  },

  init: function (deviceId, devices) {
    this.devices = JSON.parse(devices)
    this.deviceId = deviceId

    if (this.deviceId) {
      $('.' + deviceId).addClass('active')
    }

    this.initDailyUsageChart()
    this.initMonthlyUsageChart()
    this.initWsConnection()
  },

  initWsConnection: function () {
    const wsUri = 'ws://' + window.location.host + '/ws'
    ws = new WebSocket(wsUri)
    ws.onopen = function () {
      console.log('Websocket connection established')
      $('#connection-error').hide(200)

      dash.devices.forEach(function (device) {
        ws.send(JSON.stringify({
          requestType: 'getCachedData',
          deviceId: device.deviceId
        }))
      })
    }
    ws.onmessage = dash.wsMessageHandler

    ws.onclose = function () {
      // Usually caused by mobile devices going to sleep or the user minimising the browser app.
      // The setTimeout will begin once the device wakes from sleep or the browser regains focus.
      $('#connection-error').show()
      setTimeout(dash.initWsConnection, 2000)
    }
  },

  wsMessageHandler: function (messageEvent) {
    const message = JSON.parse(messageEvent.data)

    if (message.dataType === 'dailyUsage') {
      dash.parseDailyUsageData(message)
    } else if (message.dataType === 'monthlyUsage') {
      dash.parseMonthlyUsageData(message)
    }
  },

  initDailyUsageChart: function () {
    const ctx = document.getElementById('du-chart').getContext('2d')

    this.dailyUsageChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: []
      },
      options: {
        // responsive: false,
        legend: {
          display: false
        },
        scales: {
          yAxes: [{
            ticks: {
              beginAtZero: true
            }
          }]
        },
        maintainAspectRatio: false,
        tooltips: {
          intersect: false
        },
        scales: {
          xAxes: [{
            stacked: true // this should be set to make the bars stacked
          }],
          yAxes: [{
            stacked: true // this also..
          }]
        }
      }
    })
  },

  initMonthlyUsageChart: function () {
    const ctx = document.getElementById('mu-chart').getContext('2d')
    this.monthlyUsageChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: []
      },
      options: {
        // responsive: false,
        legend: {
          display: false
        },
        scales: {
          yAxes: [{
            ticks: {
              beginAtZero: true
            }
          }]
        },
        maintainAspectRatio: false,
        tooltips: {
          intersect: false
        },
        scales: {
          xAxes: [{
            stacked: true // this should be set to make the bars stacked
          }],
          yAxes: [{
            stacked: true // this also..
          }]
        }
      }
    })
  },

  parseDailyUsageData: function (usageData) {
    usageData.data.forEach(function (entry) {
      // Months from API response are 1 based
      const day = moment([entry.year, entry.month - 1, entry.day])

      if (!(day.format('MMM D') in dash.dailyGraphData)) {
        dash.dailyGraphData[day.format('MMM D')] = {}
      }
      dash.dailyGraphData[day.format('MMM D')][usageData.deviceId] = dash.energyEntryInkWh(entry)
    })

    const dailyTotal = usageData.data.find(function (d) {
      return d.day === moment().date() && d.month === (moment().month() + 1) && d.year === moment().year()
    })

    const energy = dash.energyEntryInkWh(dailyTotal)
    const total = usageData.data.reduce(function (t, d) { return t + dash.energyEntryInkWh(d) }, 0)
    const avg = total / usageData.data.length

    dash.dailyStats['total-day-kwh'][usageData.deviceId] = energy
    dash.dailyStats['total-day-currency'][usageData.deviceId] = (energy * 0.33)
    dash.dailyStats['30-total-kwh'][usageData.deviceId] = total
    dash.dailyStats['30-total-currency'][usageData.deviceId] = (total * 0.33)
    dash.dailyStats['avg-day-kwh'][usageData.deviceId] = avg
    dash.dailyStats['avg-day-currency'][usageData.deviceId] = (avg * 0.33)

    dash.updateDailyUsageChart()
    dash.setDailyUsageStats()
  },

  parseMonthlyUsageData: function (usageData) {
    usageData.data.forEach(function (entry) {
      // Months from API response are 1 based
      const month = moment().month(entry.month - 1)

      if (!(month.format('MMM') in dash.monthlyGraphData)) {
        dash.monthlyGraphData[month.format('MMM')] = {}
      }
      dash.monthlyGraphData[month.format('MMM')][usageData.deviceId] = dash.energyEntryInkWh(entry)
    })

    const monthlyTotal = usageData.data.find(function (m) {
      return m.month === (moment().month() + 1) && m.year === moment().year()
    })
    const energy = dash.energyEntryInkWh(monthlyTotal)

    // don't use latest (current) month in the average and don't use months with zero usage
    const nonZeroCompleteMonths = usageData.data.slice(0, usageData.data.length - 1).filter(u => dash.energyEntryInkWh(u) > 0)
    const total = nonZeroCompleteMonths.reduce(function (t, m) { return t + dash.energyEntryInkWh(m) }, 0)
    const avg = nonZeroCompleteMonths.length === 0 ? 0 : total / nonZeroCompleteMonths.length
    const allTotal = total + dash.energyEntryInkWh(usageData.data[usageData.data.length - 1])

    dash.monthlyStats['total-month-kwh'][usageData.deviceId] = energy
    dash.monthlyStats['total-month-currency'][usageData.deviceId] = (energy * 0.33)
    dash.monthlyStats['avg-month'][usageData.deviceId] = avg
    dash.monthlyStats['months-total-kwh'][usageData.deviceId] = allTotal
    dash.monthlyStats['months-total-currency'][usageData.deviceId] = (allTotal * 0.33)

    dash.updateMonthlyUsageChart()
    dash.setMonthlyUsageStats()
  },

  setMonthlyUsageStats: function () {
    for (const statType in dash.monthlyStats) {
      let totalForStat = 0.0

      for (const device in dash.monthlyStats[statType]) {
        totalForStat += parseFloat(dash.monthlyStats[statType][device])
      }

      $('#' + statType).text(totalForStat.toFixed(2))
    }
  },

  setDailyUsageStats: function () {
    for (const statType in dash.dailyStats) {
      let totalForStat = 0.0

      for (const device in dash.dailyStats[statType]) {
        totalForStat += parseFloat(dash.dailyStats[statType][device])
      }

      $('#' + statType).text(totalForStat.toFixed(2))
    }
  },

  updateDailyUsageChart: function () {
    dash.dailyUsageChart.data.labels = []
    dash.dailyUsageChart.data.datasets = []

    const deviceData = {}

    for (const date in dash.dailyGraphData) {
      dash.dailyUsageChart.data.labels.push(date)

      for (const deviceID in dash.dailyGraphData[date]) {
        if (!(deviceID in deviceData)) {
          deviceData[deviceID] = []
        }
        deviceData[deviceID].push(dash.dailyGraphData[date][deviceID])
      }
    }

    for (const device in deviceData) {
      dash.dailyUsageChart.data.datasets.push({
        label: dash.findDeviceById(device).alias + ' (kWh)',
        data: deviceData[device],
        backgroundColor: '#' + device.substr(device.length - 6)
      })
    }

    dash.dailyUsageChart.update()
  },

  updateMonthlyUsageChart: function () {
    dash.monthlyUsageChart.data.labels = []
    dash.monthlyUsageChart.data.datasets = []

    const deviceData = {}

    for (const date in dash.monthlyGraphData) {
      dash.monthlyUsageChart.data.labels.push(date)
      for (const deviceID in dash.monthlyGraphData[date]) {
        if (!(deviceID in deviceData)) {
          deviceData[deviceID] = []
        }
        deviceData[deviceID].push(dash.monthlyGraphData[date][deviceID])
      }
    }

    for (const device in deviceData) {
      dash.monthlyUsageChart.data.datasets.push({
        label: dash.findDeviceById(device).alias + ' (kWh)',
        data: deviceData[device],
        backgroundColor: '#' + device.substr(device.length - 6)
      })
    }

    dash.monthlyUsageChart.update()
  },

  findDeviceById: function (deviceId) {
    return dash.devices.find(d => d.deviceId === deviceId)
  },

  energyEntryInkWh: function (entry) {
    return ('energy_wh' in entry) ? (entry.energy_wh / 1000) : entry.energy
  }
}
