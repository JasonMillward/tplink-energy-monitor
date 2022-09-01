const dash = {
  ws: null,

  deviceId: null,

  realtimeGauge: null,
  realtimeTrendChart: null,
  realtimeTrendLastSample: 0,

  dailyUsageChart: null,
  monthlyUsageChart: null,
  usageLogChart: null,

  init: function (deviceId) {
    this.deviceId = deviceId

    if (this.deviceId) {
      $('.' + deviceId).addClass('active')
    }

    this.initRealtimeGauge()
    this.initRealtimeTrendChart()
    this.initDailyUsageChart()
    this.initMonthlyUsageChart()
    this.initUsageLog()

    this.initWsConnection()
    this.initTogglePowerState()
  },

  initWsConnection: function () {
    const wsUri = 'ws://' + window.location.host + '/ws'
    ws = new WebSocket(wsUri)
    ws.onopen = function () {
      console.log('Websocket connection established')
      $('#connection-error').hide(200)
      ws.send(JSON.stringify(
        {
          requestType: 'getCachedData',
          deviceId: dash.deviceId
        }
      ))
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
    if (message.deviceId === dash.deviceId) {
      if (message.dataType === 'realtimeUsage') {
        dash.refreshRealtimeDisplay(message.data)
      } else if (message.dataType === 'dailyUsage') {
        dash.parseDailyUsageData(message.data)
      } else if (message.dataType === 'monthlyUsage') {
        dash.parseMonthlyUsageData(message.data)
      } else if (message.dataType === 'powerState') {
        dash.refreshPowerState(message.data)
      } else if (message.dataType === 'newLogEntry') {
        dash.addLogEntry(message.data, true)
      } else if (message.dataType === 'loggedData') {
        dash.loadLogEntries(message.data)
        dash.loadLastSession(message.data)
      }
    }
  },

  initRealtimeGauge: function () {
    const opts = {
      angle: 0,
      lineWidth: 0.2,
      pointer: {
        length: 0.6,
        strokeWidth: 0.035,
        color: '#000000'
      },
      limitMax: true,
      limitMin: true,
      generateGradient: true,
      highDpiSupport: true,
      staticLabels: {
        font: '12px sans-serif',
        labels: [500, 1500, 3000]
      },
      staticZones: [
        { strokeStyle: '#30B32D', min: 0, max: 500 },
        { strokeStyle: '#FFDD00', min: 500, max: 2400 },
        { strokeStyle: '#F03E3E', min: 2400, max: 3000 }
      ]
    }
    const target = document.getElementById('rtu-gauge')

    dash.realtimeGauge = new Gauge(target).setOptions(opts)
    dash.realtimeGauge.maxValue = 3000
    dash.realtimeGauge.setMinValue(0)
    dash.realtimeGauge.animationSpeed = 32
  },

  initRealtimeTrendChart: function () {
    const ctx = document.getElementById('rtt-chart').getContext('2d')
    this.realtimeTrendChart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: 'Power (W)',
          borderColor: 'rgb(255, 99, 132)',
          data: []
        }]
      },
      options: {
        legend: {
          display: false
        },
        scales: {
          xAxes: [{
            display: false,
            type: 'realtime'
          }],
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
        plugins: {
          streaming: {
            duration: 60000,
            refresh: 1000,
            delay: 1000,
            frameRate: 30,
            onRefresh: dash.realtimeTrendChartOnRefresh
          }
        }
      }
    })
  },

  initDailyUsageChart: function () {
    const ctx = document.getElementById('du-chart').getContext('2d')
    this.dailyUsageChart = new Chart(ctx, {
      type: 'bar',
      data: {
        datasets: [{
          label: 'Energy (kWh)',
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgb(255, 99, 132)',
          data: []
        }]
      },
      options: {
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
        }
      }
    })
  },

  initMonthlyUsageChart: function () {
    const ctx = document.getElementById('mu-chart').getContext('2d')
    this.monthlyUsageChart = new Chart(ctx, {
      type: 'bar',
      data: {
        datasets: [{
          label: 'Energy (kWh)',
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgb(255, 99, 132)',
          data: []
        }]
      },
      options: {
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
        }
      }
    })
  },

  initUsageLog: function () {
    const ctx = document.getElementById('logged-usage-chart').getContext('2d')
    this.usageLogChart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: 'Power (W)',
          borderColor: 'rgb(255, 99, 132)',
          data: []
        }]
      },
      options: {
        legend: {
          display: false
        },
        scales: {
          xAxes: [{
            display: true
          }],
          yAxes: [{
            ticks: {
              beginAtZero: true
            }
          }]
        },
        maintainAspectRatio: false,
        tooltips: {
          intersect: false
        }
      }
    })
  },

  initTogglePowerState: () => {
    $('#power-state').on('click', () => {
      if (ws) {
        ws.send(JSON.stringify(
          {
            requestType: 'togglePowerState',
            deviceId: dash.deviceId
          }
        ))
      }
    })
  },

  addLogEntry: function (logEntry, updateChart) {
    dash.usageLogChart.data.labels.push(moment(logEntry.ts, 'x').format('MMM Do HH:mm'))
    dash.usageLogChart.data.datasets.forEach(function (dataset) {
      dataset.data.push({
        x: logEntry.ts,
        y: logEntry.pw
      })
    })
    if (updateChart) {
      dash.usageLogChart.update()
    }
  },

  loadLogEntries: function (logEntries) {
    logEntries.forEach(function (entry) {
      dash.addLogEntry(entry, false)
    })

    dash.usageLogChart.update()
  },

  loadLastSession: function (logEntries) {
    const threshold = 5
    let startIndex = 0
    for (let i = logEntries.length - 1; i > 0; i--) {
      if (logEntries[i].pw > threshold) {
        startIndex = i
        break
      }
    }
    if (startIndex > 0) {
      let endIndex = -1
      for (let i = startIndex - 1; i >= 0; i--) {
        if (logEntries[i].pw < threshold || i === 0) {
          endIndex = i
          break
        }
      }
      if (endIndex >= 0) {
        var lastSessionkWh = 0
        if (startIndex = logEntries.length - 1) {
          startIndex--
        }
        for (let i = endIndex; i < startIndex; i++) {
          const entry = logEntries[i]
          const power = entry.pw
          const time = logEntries[i + 1].ts - entry.ts
          const kWh = power * time / 3600000000
          lastSessionkWh += kWh
        }
      }
      $('#lastsession').text((endIndex === 0 ? '>' : '') + lastSessionkWh.toFixed(1))
    }
  },

  realtimeTrendChartOnRefresh: function (chart) {
    chart.data.datasets.forEach(function (dataset) {
      dataset.data.push({
        x: Date.now(),
        y: dash.realtimeTrendLastSample
      })
    })
  },

  refreshRealtimeDisplay: function (realtime) {
    const power = Math.round(('power_mw' in realtime) ? (realtime.power_mw / 1000) : realtime.power)
    const current = (('current_ma' in realtime) ? (realtime.current_ma / 1000) : realtime.current).toFixed(2)
    const voltage = Math.round(('voltage_mv' in realtime) ? (realtime.voltage_mv / 1000) : realtime.voltage)

    this.realtimeGauge.set(power)
    // might switch to Vue.js if this gets tedious
    $('#rtu-power').text(power + ' W')
    $('#rtu-current').text(current + ' A')
    $('#rtu-voltage').text(voltage + ' V')

    this.realtimeTrendLastSample = power
  },

  parseDailyUsageData: function (usageData) {
    // Clear previous data
    dash.dailyUsageChart.data.labels = []
    dash.dailyUsageChart.data.datasets.forEach(function (dataset) {
      dataset.data = []
    })

    usageData.forEach(function (entry) {
      // Months from API response are 1 based
      const day = moment([entry.year, entry.month - 1, entry.day])

      dash.dailyUsageChart.data.labels.push(day.format('MMM D'))
      dash.dailyUsageChart.data.datasets.forEach(function (dataset) {
        dataset.data.push(dash.energyEntryInkWh(entry))
      })
    })

    dash.dailyUsageChart.update()
    dash.setDailyUsageStats(usageData)
  },

  setDailyUsageStats: function (usageData) {
    const dailyTotal = usageData.find(function (d) {
      return d.day === moment().date() && d.month === (moment().month() + 1) && d.year === moment().year()
    })

    const energy = dash.energyEntryInkWh(dailyTotal)
    const total = usageData.reduce(function (t, d) { return t + dash.energyEntryInkWh(d) }, 0)
    const avg = total / usageData.length

    $('#total-day').text(energy.toFixed(2))

    $('#30-total-kwh').text(total.toFixed(0))
    $('#30-total-currency').text((total * 0.33).toFixed(0))

    $('#avg-day-kwh').text(avg.toFixed(2))
    $('#avg-day-currency').text((avg * 0.33).toFixed(2))
  },

  parseMonthlyUsageData: function (usageData) {
    // Clear previous data
    dash.monthlyUsageChart.data.labels = []
    dash.monthlyUsageChart.data.datasets.forEach(function (dataset) {
      dataset.data = []
    })

    usageData.forEach(function (entry) {
      // Months from API response are 1 based
      const month = moment().month(entry.month - 1)

      dash.monthlyUsageChart.data.labels.push(month.format('MMM'))
      dash.monthlyUsageChart.data.datasets.forEach(function (dataset) {
        dataset.data.push(dash.energyEntryInkWh(entry))
      })
    })

    dash.monthlyUsageChart.update()
    dash.setMonthlyUsageStats(usageData)
  },

  setMonthlyUsageStats: function (usageData) {
    const monthlyTotal = usageData.find(function (m) {
      return m.month === (moment().month() + 1) && m.year === moment().year()
    })
    const energy = dash.energyEntryInkWh(monthlyTotal)

    // don't use latest (current) month in the average and don't use months with zero usage
    const nonZeroCompleteMonths = usageData.slice(0, usageData.length - 1).filter(u => dash.energyEntryInkWh(u) > 0)
    const total = nonZeroCompleteMonths.reduce(function (t, m) { return t + dash.energyEntryInkWh(m) }, 0)
    const avg = nonZeroCompleteMonths.length === 0 ? 0 : total / nonZeroCompleteMonths.length
    const allTotal = total + dash.energyEntryInkWh(usageData[usageData.length - 1])

    $('#total-month-kwh').text(energy.toFixed(2))
    $('#total-month-currency').text((energy * 0.33).toFixed(2))

    $('#avg-month').text(avg.toFixed(2))

	  $('#months-total-kwh').text(allTotal.toFixed(0))
    $('#months-total-currency').text((allTotal * 0.33).toFixed(0))
  },

  energyEntryInkWh: function (entry) {
    return ('energy_wh' in entry) ? (entry.energy_wh / 1000) : entry.energy
  },

  refreshPowerState: function (powerState) {
    if (powerState.isOn) {
      $('#power-state').text('ON').attr('class', 'label label-success')
    } else {
      $('#power-state').text('OFF').attr('class', 'label label-danger')
    }

    if (powerState.uptime === 0) {
      $('#uptime').text('-')
    } else if (powerState.uptime > 60) {
      $('#uptime').text(moment.duration(powerState.uptime, 'seconds').format('d[d] h[h] m[m]', { largest: 2 }))
    } else {
      $('#uptime').text(moment.duration(powerState.uptime, 'seconds').format('m[m] s[s]', { largest: 2 }))
    }
  }
}
