'use strict';

'require dom';
'require fs';
'require poll';
'require ui';
'require view';

var collector = '/usr/libexec/ndpi-collector';
var maxDuration = 43200;
var chartLoadPromise;
var activeCharts = [];
var chartColors = [
	'#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
	'#06b6d4', '#ec4899', '#84cc16', '#f97316', '#64748b'
];

function linesToObject(text) {
	return String(text || '').split('\n').reduce(function(result, line) {
		var separator = line.indexOf('=');
		if (separator > 0)
			result[line.substring(0, separator)] = line.substring(separator + 1);
		return result;
	}, {});
}

function formatDuration(seconds) {
	seconds = Number(seconds) || 0;
	var hours = Math.floor(seconds / 3600);
	var minutes = Math.floor((seconds % 3600) / 60);
	var remaining = seconds % 60;
	var parts = [];
	if (hours)
		parts.push(hours + _(' 小时'));
	if (minutes)
		parts.push(minutes + _(' 分钟'));
	if (remaining || !parts.length)
		parts.push(remaining + _(' 秒'));
	return parts.join(' ');
}

function formatTime(value) {
	var timestamp = Number(value);
	if (timestamp)
		return new Date(timestamp * 1000).toLocaleString();

	/* Older records have an already-formatted completion time. */
	return String(value || '').trim() || '-';
}

function formatNumber(value) {
	return (Number(value) || 0).toLocaleString();
}

function formatBytes(value) {
	var bytes = Number(value) || 0;
	var units = [ 'B', 'KiB', 'MiB', 'GiB', 'TiB' ];
	var index = 0;

	while (bytes >= 1024 && index < units.length - 1) {
		bytes /= 1024;
		index++;
	}

	return (index ? bytes.toFixed(bytes >= 10 ? 1 : 2) : Math.round(bytes)) + ' ' + units[index];
}

function parseProtocols(raw) {
	var inProtocols = false;
	var protocols = [];

	String(raw || '').split('\n').forEach(function(line) {
		if (/^Detected protocols:/.test(line.trim())) {
			inProtocols = true;
			return;
		}
		if (/^(Protocol statistics:|Risky flows:|Additional flow information:)/.test(line.trim())) {
			inProtocols = false;
			return;
		}
		if (!inProtocols)
			return;

		var match = line.match(/^\s*(.+?)\s+packets:\s+(\d+)\s+bytes:\s+(\d+)\s+flows:\s+(\d+)/);
		if (match) {
			protocols.push({
				name: match[1],
				packets: Number(match[2]),
				bytes: Number(match[3]),
				flows: Number(match[4])
			});
		}
	});

	return protocols.sort(function(a, b) { return b.bytes - a.bytes; });
}

function parseTrafficMetrics(raw) {
	var text = String(raw || '');
	var metrics = {
		bytes: 0,
		packets: 0,
		totalPackets: 0,
		flows: 0,
		ethernetBytes: 0,
		discardedBytes: 0,
		tcpPackets: 0,
		udpPackets: 0,
		vlanPackets: 0,
		mplsPackets: 0,
		pppoePackets: 0,
		fragmentedPackets: 0,
		maxPacketSize: 0,
		packetLengths: [ 0, 0, 0, 0, 0, 0 ]
	};
	var patterns = {
		bytes: /^\s*IP bytes:\s+(\d+)/m,
		packets: /^\s*IP packets:\s+(\d+)/m,
		totalPackets: /^\s*IP packets:\s+\d+\s+of\s+(\d+)/m,
		flows: /^\s*Unique flows:\s+(\d+)/m,
		ethernetBytes: /^\s*Ethernet bytes:\s+(\d+)/m,
		discardedBytes: /^\s*Discarded bytes:\s+(\d+)/m,
		tcpPackets: /^\s*TCP Packets:\s+(\d+)/m,
		udpPackets: /^\s*UDP Packets:\s+(\d+)/m,
		vlanPackets: /^\s*VLAN Packets:\s+(\d+)/m,
		mplsPackets: /^\s*MPLS Packets:\s+(\d+)/m,
		pppoePackets: /^\s*PPPoE Packets:\s+(\d+)/m,
		fragmentedPackets: /^\s*Fragmented Packets:\s+(\d+)/m,
		maxPacketSize: /^\s*Max Packet size:\s+(\d+)/m
	};
	var packetLengthPatterns = [
		/^\s*Packet Len < 64:\s+(\d+)/m,
		/^\s*Packet Len 64-128:\s+(\d+)/m,
		/^\s*Packet Len 128-256:\s+(\d+)/m,
		/^\s*Packet Len 256-1024:\s+(\d+)/m,
		/^\s*Packet Len 1024-1500:\s+(\d+)/m,
		/^\s*Packet Len > 1500:\s+(\d+)/m
	];

	Object.keys(patterns).forEach(function(key) {
		var match = text.match(patterns[key]);
		if (match)
			metrics[key] = Number(match[1]);
	});
	packetLengthPatterns.forEach(function(pattern, index) {
		var match = text.match(pattern);
		if (match)
			metrics.packetLengths[index] = Number(match[1]);
	});

	return metrics;
}

function ensureChartLibrary() {
	if (window.Chart)
		return Promise.resolve(window.Chart);
	if (chartLoadPromise)
		return chartLoadPromise;

	chartLoadPromise = new Promise(function(resolve, reject) {
		var script = E('script', {
			'type': 'text/javascript',
			'src': L.resource('nlbw.chart.min.js')
		});
		script.addEventListener('load', function() { resolve(window.Chart); });
		script.addEventListener('error', function() { reject(new Error(_('无法加载图表组件。'))); });
		document.head.appendChild(script);
	});

	return chartLoadPromise;
}

function chartData(protocols) {
	var visible = protocols.slice(0, 9);
	var otherBytes = protocols.slice(9).reduce(function(total, protocol) {
		return total + protocol.bytes;
	}, 0);

	if (otherBytes) {
		visible.push({
			name: _('其他协议'),
			bytes: otherBytes
		});
	}

	return visible.map(function(protocol, index) {
		return {
			value: protocol.bytes,
			color: chartColors[index % chartColors.length],
			highlight: chartColors[index % chartColors.length],
			label: '%s: %s'.format(protocol.name, formatBytes(protocol.bytes))
		};
	});
}

function packetLengthChartData(metrics) {
	return {
		labels: [ '<64', '64–128', '128–256', '256–1024', '1024–1500', '>1500' ],
		datasets: [ {
			label: _('数据包数量'),
			fillColor: 'rgba(59, 130, 246, 0.12)',
			strokeColor: 'rgba(37, 99, 235, 0.9)',
			pointColor: 'rgba(37, 99, 235, 1)',
			pointStrokeColor: '#ffffff',
			pointHighlightFill: '#ffffff',
			pointHighlightStroke: 'rgba(30, 64, 175, 1)',
			data: metrics.packetLengths
		} ]
	};
}

function registerPacketLengthChart(Chart) {
	if (Chart.types.PacketLength)
		return;

	/* luci-lib-chartjs only ships Doughnut. Register the small chart type we
	 * need instead of calling its absent Line() or Bar() helpers. */
	Chart.Type.extend({
		name: 'PacketLength',
		defaults: {
			animation: false,
			showTooltips: false
		},
		initialize: function(data) {
			this.data = data;
			this.render();
		},
		draw: function() {
			var ctx = this.chart.ctx;
			var width = this.chart.width;
			var height = this.chart.height;
			var values = this.data.datasets[0].data;
			var labels = this.data.labels;
			var maxValue = Math.max.apply(null, values.concat([ 1 ]));
			var chartLeft = 48;
			var chartRight = width - 12;
			var chartTop = 18;
			var chartBottom = height - 40;
			var chartWidth = chartRight - chartLeft;
			var chartHeight = chartBottom - chartTop;
			var stepCount = 4;
			var slotWidth = chartWidth / values.length;
			var barWidth = Math.min(42, slotWidth * 0.66);
			var dataset = this.data.datasets[0];

			this.clear();
			ctx.font = '11px sans-serif';
			ctx.textBaseline = 'middle';
			ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
			ctx.fillStyle = '#666';

			for (var step = 0; step <= stepCount; step++) {
				var y = chartBottom - chartHeight * step / stepCount;
				var tick = Math.round(maxValue * step / stepCount);
				ctx.beginPath();
				ctx.moveTo(chartLeft, y);
				ctx.lineTo(chartRight, y);
				ctx.stroke();
				ctx.textAlign = 'right';
				ctx.fillText(formatNumber(tick), chartLeft - 7, y);
			}

			ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
			ctx.beginPath();
			ctx.moveTo(chartLeft, chartTop);
			ctx.lineTo(chartLeft, chartBottom);
			ctx.lineTo(chartRight, chartBottom);
			ctx.stroke();

			values.forEach(function(value, index) {
				var barHeight = chartHeight * value / maxValue;
				var x = chartLeft + slotWidth * index + (slotWidth - barWidth) / 2;
				var y = chartBottom - barHeight;
				ctx.fillStyle = dataset.fillColor;
				ctx.fillRect(x, y, barWidth, barHeight);
				ctx.strokeStyle = dataset.strokeColor;
				ctx.strokeRect(x, y, barWidth, barHeight);
				ctx.fillStyle = '#444';
				ctx.textAlign = 'center';
				ctx.fillText(labels[index], x + barWidth / 2, chartBottom + 15);
				ctx.fillText(formatNumber(value), x + barWidth / 2, Math.max(chartTop + 6, y - 7));
			});
		}
	});
}

function destroyCharts() {
	activeCharts.forEach(function(chart) { chart.destroy(); });
	activeCharts = [];
}

return view.extend({
	load: function() {
		return Promise.all([
			fs.exec(collector, [ 'status' ]),
			fs.exec(collector, [ 'list' ])
		]);
	},

	render: function(data) {
		var status = linesToObject(data[0] && data[0].stdout);
		var collectionRunning = status.state === 'collecting';
		var reports = E('tbody');
		var state = E('div', { 'class': 'alert-message notice' });
		var duration = E('input', {
			'class': 'cbi-input-text',
			'type': 'number',
			'min': 1,
			'max': maxDuration,
			'value': 300
		});
		var startButton = E('button', {
			'class': 'btn cbi-button cbi-button-action',
			'click': ui.createHandlerFn(this, function() {
				var seconds = Number(duration.value);
				if (!Number.isInteger(seconds) || seconds < 1 || seconds > maxDuration) {
					ui.addNotification(null, E('p', {}, _('采集时长必须为 1 到 43200 秒（12 小时）。')), 'danger');
					return;
				}
				startButton.disabled = true;
				return fs.exec(collector, [ 'start', String(seconds) ]).then(function(result) {
					if (result.code !== 0)
						throw new Error(result.stderr || _('无法启动采集任务。'));
					collectionRunning = true;
					duration.disabled = true;
					ui.addNotification(null, E('p', {}, result.stdout || _('采集任务已启动。')), 'info');
					return refresh();
				}).catch(function(error) {
					ui.addNotification(null, E('p', {}, error.message), 'danger');
				}).finally(function() {
					startButton.disabled = collectionRunning;
					duration.disabled = collectionRunning;
				});
			})
		}, _('开始采集'));

		function showOutput(id, type) {
			return fs.exec(collector, [ type, id ]).then(function(result) {
				if (result.code !== 0)
					throw new Error(result.stderr || _('读取采集数据失败。'));
				ui.showModal(_('ndpiReader 原始数据'), [
					E('pre', { 'style': 'max-height: 65vh; overflow: auto; white-space: pre-wrap' }, result.stdout || _('没有输出。')),
					E('div', { 'class': 'right' }, [
						E('button', { 'class': 'btn', 'click': ui.hideModal }, _('关闭'))
					])
				]);
			}).catch(function(error) {
				ui.addNotification(null, E('p', {}, error.message), 'danger');
			});
		}

		function showTextReport(text) {
			ui.showModal(_('nDPI 文字报告'), [
				E('pre', { 'style': 'max-height: 65vh; overflow: auto; white-space: pre-wrap' }, text || _('没有输出。')),
				E('div', { 'class': 'right' }, [
					E('button', { 'class': 'btn', 'click': ui.hideModal }, _('关闭'))
				])
			]);
		}

		function showReport(id) {
			return Promise.all([
				fs.exec(collector, [ 'report', id ]),
				fs.exec(collector, [ 'raw', id ])
			]).then(function(result) {
				if (result[0].code !== 0 || result[1].code !== 0)
					throw new Error((result[0].stderr || result[1].stderr) || _('读取采集数据失败。'));

				var reportText = result[0].stdout || '';
				var rawText = result[1].stdout || '';
				var protocols = parseProtocols(rawText);
				var metrics = parseTrafficMetrics(rawText);
				var protocolBytes = protocols.reduce(function(total, protocol) {
					return total + protocol.bytes;
				}, 0);
				var packetLengthTotal = metrics.packetLengths.reduce(function(total, value) {
					return total + value;
				}, 0);
				var canvas = E('canvas', { 'width': 420, 'height': 260 });
				var chartMessage = E('div', { 'class': 'cbi-value-description' }, _('正在加载协议流量图表…'));
				var chartContainer = E('div', {
					'style': 'max-width: 460px; margin: 1em auto; text-align: center'
				}, [ canvas, chartMessage ]);
				var packetLengthCanvas = E('canvas', { 'width': 580, 'height': 250 });
				var packetLengthMessage = E('div', { 'class': 'cbi-value-description' }, _('正在加载包长分布图…'));
				var packetLengthContainer = E('div', {
					'style': 'max-width: 620px; margin: 1em auto; text-align: center'
				}, [ packetLengthCanvas, packetLengthMessage ]);
				var trafficRows = [
					[ _('以太网流量'), formatBytes(metrics.ethernetBytes) ],
					[ _('IP 流量'), formatBytes(metrics.bytes) ],
					[ _('丢弃流量'), formatBytes(metrics.discardedBytes) ],
					[ _('捕获数据包'), formatNumber(metrics.totalPackets) ],
					[ _('IP 数据包'), formatNumber(metrics.packets) ],
					[ _('TCP / UDP 数据包'), '%s / %s'.format(formatNumber(metrics.tcpPackets), formatNumber(metrics.udpPackets)) ],
					[ _('VLAN / MPLS / PPPoE'), '%s / %s / %s'.format(formatNumber(metrics.vlanPackets), formatNumber(metrics.mplsPackets), formatNumber(metrics.pppoePackets)) ],
					[ _('分片数据包'), formatNumber(metrics.fragmentedPackets) ],
					[ _('最大包长'), formatBytes(metrics.maxPacketSize) ]
				];
				var rows = protocols.slice(0, 20).map(function(protocol) {
					var percent = protocolBytes ? (protocol.bytes * 100 / protocolBytes).toFixed(1) + '%' : '-';
					return E('tr', {}, [
						E('td', {}, protocol.name),
						E('td', {}, formatBytes(protocol.bytes)),
						E('td', {}, formatNumber(protocol.packets)),
						E('td', {}, formatNumber(protocol.flows)),
						E('td', {}, percent)
					]);
				});
				var close = function() {
					destroyCharts();
					ui.hideModal();
				};

				if (!rows.length || protocolBytes === 0) {
					rows.push(E('tr', {}, E('td', { 'colspan': 5 }, _('ndpiReader 未识别出可供统计的协议流量。'))));
					chartMessage.textContent = _('没有协议流量数据可绘制。');
					canvas.style.display = 'none';
				}
				if (packetLengthTotal === 0) {
					packetLengthMessage.textContent = _('没有包长分布数据可绘制。');
					packetLengthCanvas.style.display = 'none';
				}

				ui.showModal(_('nDPI 数据报告'), [
					E('div', { 'class': 'cbi-map-descr' }, _('报告包含 ndpiReader 的 Traffic statistics 与协议识别结果。协议图按字节数排序，前 9 项之外的协议合并为“其他协议”。')),
					E('h3', {}, _('Traffic statistics')),
					E('div', { 'class': 'cbi-section' }, [
						E('div', { 'class': 'cbi-value' }, [
							E('label', { 'class': 'cbi-value-title' }, _('IP 流量')),
							E('div', { 'class': 'cbi-value-field' }, formatBytes(metrics.bytes))
						]),
						E('div', { 'class': 'cbi-value' }, [
							E('label', { 'class': 'cbi-value-title' }, _('IP 数据包')),
							E('div', { 'class': 'cbi-value-field' }, formatNumber(metrics.packets))
						]),
						E('div', { 'class': 'cbi-value' }, [
							E('label', { 'class': 'cbi-value-title' }, _('唯一流')),
							E('div', { 'class': 'cbi-value-field' }, formatNumber(metrics.flows))
						]),
						E('div', { 'class': 'cbi-value' }, [
							E('label', { 'class': 'cbi-value-title' }, _('已识别协议')),
							E('div', { 'class': 'cbi-value-field' }, formatNumber(protocols.length))
						])
					]),
					E('div', { 'style': 'max-height: 24vh; overflow: auto' }, E('table', { 'class': 'table cbi-section-table' }, [
						E('tbody', {}, trafficRows.map(function(row) {
							return E('tr', {}, [ E('th', {}, row[0]), E('td', {}, row[1]) ]);
						}))
					])),
					packetLengthContainer,
					E('h3', {}, _('协议流量分布')),
					chartContainer,
					E('h3', {}, _('协议明细（前 20 项）')),
					E('div', { 'style': 'max-height: 30vh; overflow: auto' }, E('table', { 'class': 'table cbi-section-table' }, [
						E('thead', {}, E('tr', {}, [
							E('th', {}, _('协议')),
							E('th', {}, _('流量')),
							E('th', {}, _('数据包')),
							E('th', {}, _('流')),
							E('th', {}, _('占比'))
						])),
						E('tbody', {}, rows)
					])),
					E('div', { 'class': 'right', 'style': 'margin-top: 1em' }, [
						E('button', {
							'class': 'btn cbi-button cbi-button-neutral',
							'click': function() {
								close();
								showTextReport(reportText);
							}
						}, _('文字报告')),
						' ',
						E('button', {
							'class': 'btn cbi-button cbi-button-neutral',
							'click': function() {
								close();
								showOutput(id, 'raw');
							}
						}, _('查看原始数据')),
						' ',
						E('button', { 'class': 'btn', 'click': close }, _('关闭'))
					])
				]);

				if (protocolBytes > 0 || packetLengthTotal > 0) {
					ensureChartLibrary().then(function(Chart) {
						if (!document.body.contains(canvas) || !document.body.contains(packetLengthCanvas))
							return;
						destroyCharts();
						if (protocolBytes > 0) {
							activeCharts.push(new Chart(canvas.getContext('2d')).Doughnut(chartData(protocols), {
								segmentStrokeWidth: 1,
								percentageInnerCutout: 45,
								showTooltips: true
							}));
							chartMessage.textContent = _('将鼠标悬停在图表区域可查看协议与流量。');
						}
						if (packetLengthTotal > 0) {
							registerPacketLengthChart(Chart);
							activeCharts.push(new Chart(packetLengthCanvas.getContext('2d')).PacketLength(packetLengthChartData(metrics)));
							packetLengthMessage.textContent = _('横轴为数据包长度（字节），纵轴为数据包数量。');
						}
					}).catch(function(error) {
						if (protocolBytes > 0)
							chartMessage.textContent = error.message;
						if (packetLengthTotal > 0)
							packetLengthMessage.textContent = error.message;
					});
				}
			}).catch(function(error) {
				ui.addNotification(null, E('p', {}, error.message), 'danger');
			});
		}

		function renderReports(text) {
			dom.content(reports, String(text || '').trim().split('\n').filter(Boolean).map(function(line) {
				var fields = line.split('\t');
				var id = fields[0];
				return E('tr', {}, [
					E('td', { 'style': 'white-space: nowrap' }, formatTime(fields[1])),
					E('td', {}, fields[3] || '-'),
					E('td', { 'style': 'white-space: nowrap' }, formatDuration(fields[2])),
					E('td', { 'class': 'cbi-section-actions', 'style': 'white-space: nowrap' }, [
						E('button', {
							'class': 'btn cbi-button cbi-button-action',
							'click': ui.createHandlerFn(this, showReport, id)
						}, _('查看报告')),
						' ',
						E('button', {
							'class': 'btn cbi-button cbi-button-neutral',
							'click': ui.createHandlerFn(this, showOutput, id, 'raw')
						}, _('原始数据'))
					])
				]);
			}));
			if (!reports.childNodes.length)
				reports.appendChild(E('tr', {}, E('td', { 'colspan': 4, 'class': 'cbi-section-table-cell' }, _('尚无已完成的采集数据。'))));
		}

		function renderStatus(next) {
			var messages = {
				collecting: _('正在采集 WAN 接口 %s，已于 %s 开始；计划持续 %s。').format(next.device || '-', formatTime(next.started), formatDuration(next.duration)),
				complete: _('最近一次采集已完成。'),
				failed: _('最近一次采集失败：%s').format(next.error || _('未知错误')),
				idle: _('当前没有运行中的采集任务。')
			};
			state.className = next.state === 'failed' ? 'alert-message warning' : 'alert-message notice';
			state.textContent = messages[next.state] || messages.idle;
			collectionRunning = next.state === 'collecting';
			startButton.disabled = collectionRunning;
			duration.disabled = collectionRunning;
		}

		function refresh() {
			return Promise.all([
				fs.exec(collector, [ 'status' ]),
				fs.exec(collector, [ 'list' ])
			]).then(function(result) {
				renderStatus(linesToObject(result[0] && result[0].stdout));
				renderReports(result[1] && result[1].stdout);
			});
		}

		renderStatus(status);
		renderReports(data[1] && data[1].stdout);
		poll.add(refresh, 5);

		return E([], [
			E('h2', {}, _('nDPI WAN 流量分析')),
			E('div', { 'class': 'cbi-map-descr' }, _('使用 ndpiReader 对当前 WAN 物理接口进行限时深度协议识别。采集在后台继续运行，最多可保留最近 10 次结果。')),
			E('fieldset', { 'class': 'cbi-section' }, [
				E('legend', {}, _('采集设置')),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('采集时长（秒）')),
					E('div', { 'class': 'cbi-value-field' }, [
						duration,
						' ', startButton,
						E('div', { 'class': 'cbi-value-description' }, _('可设置 1 秒至 43200 秒（12 小时）。同一时间只能运行一个采集任务。'))
					])
				]),
				state
			]),
			E('fieldset', { 'class': 'cbi-section' }, [
				E('legend', {}, _('已保存的采集数据')),
				E('div', { 'class': 'cbi-section-descr' }, _('结果保存在内存目录中，设备重启后会清除。每次采集完成后将自动删除最早的记录，仅保留 10 次。')),
				E('table', { 'class': 'table cbi-section-table', 'style': 'width: 100%; table-layout: fixed' }, [
					E('colgroup', {}, [
						E('col', { 'style': 'width: 25%' }),
						E('col', { 'style': 'width: 15%' }),
						E('col', { 'style': 'width: 16%' }),
						E('col', { 'style': 'width: 44%' })
					]),
					E('thead', {}, E('tr', {}, [
						E('th', { 'class': 'cbi-section-table-cell' }, _('完成时间')),
						E('th', { 'class': 'cbi-section-table-cell' }, _('WAN 接口')),
						E('th', { 'class': 'cbi-section-table-cell' }, _('采集时长')),
						E('th', { 'class': 'cbi-section-table-cell' }, _('操作'))
					])),
					reports
				])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
