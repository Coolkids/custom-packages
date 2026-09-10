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
		var reportCount = E('span', { 'class': 'ndpi-badge' });
		var statusBadge = E('span', { 'class': 'ndpi-badge' });
		var state = E('div', { 'class': 'ndpi-status', 'role': 'status' });
		var duration = E('input', {
			'id': 'ndpi-duration',
			'class': 'cbi-input-text',
			'type': 'number',
			'min': 1,
			'max': maxDuration,
			'value': 300,
			'aria-describedby': 'ndpi-duration-help',
			'input': function() { updatePresets(); }
		});
		var presetButtons = [
			[ 60, _('1 分钟') ], [ 300, _('5 分钟') ],
			[ 900, _('15 分钟') ], [ 3600, _('1 小时') ]
		].map(function(preset) {
			return E('button', {
				'class': 'ndpi-preset',
				'type': 'button',
				'data-duration': preset[0],
				'click': function() {
					duration.value = preset[0];
					updatePresets();
				}
			}, preset[1]);
		});

		function updatePresets() {
			presetButtons.forEach(function(button) {
				button.disabled = duration.disabled;
				button.setAttribute('aria-pressed', String(Number(duration.value) === Number(button.getAttribute('data-duration'))));
			});
		}

		var startButton = E('button', {
			'class': 'btn cbi-button cbi-button-action',
			'click': ui.createHandlerFn(this, function() {
				var seconds = Number(duration.value);
				if (!Number.isInteger(seconds) || seconds < 1 || seconds > maxDuration) {
					ui.addNotification(null, E('p', {}, _('采集时长必须为 1 到 43200 秒（12 小时）。')), 'danger');
					return;
				}
				startButton.disabled = true;
				duration.disabled = true;
				updatePresets();
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
					updatePresets();
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
				var canvas = E('canvas', { 'width': 420, 'height': 260, 'role': 'img', 'aria-label': _('协议流量分布，详细数据见下方列表。') });
				var chartMessage = E('div', { 'class': 'cbi-value-description' }, _('正在加载协议流量图表…'));
				var chartContainer = E('div', {
					'class': 'ndpi-chart'
				}, [ canvas, chartMessage ]);
				var packetLengthCanvas = E('canvas', { 'width': 580, 'height': 250, 'role': 'img', 'aria-label': _('包长分布：') + packetLengthChartData(metrics).labels.map(function(label, index) { return label + ': ' + formatNumber(metrics.packetLengths[index]); }).join('; ') });
				var packetLengthMessage = E('div', { 'class': 'cbi-value-description' }, _('正在加载包长分布图…'));
				var packetLengthContainer = E('div', {
					'class': 'ndpi-chart'
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
						E('td', {}, [
							E('span', { 'class': 'ndpi-share', 'aria-hidden': 'true' }, E('span', { 'style': 'width: ' + (protocolBytes ? protocol.bytes * 100 / protocolBytes : 0) + '%' })),
							percent
						])
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
					E('div', { 'class': 'ndpi-report' }, [
						E('p', { 'class': 'ndpi-muted' }, _('本次采集的流量概览与协议识别结果。')),
						E('div', { 'class': 'ndpi-summary' }, [
							[ _('IP 流量'), formatBytes(metrics.bytes) ],
							[ _('IP 数据包'), formatNumber(metrics.packets) ],
							[ _('唯一流'), formatNumber(metrics.flows) ],
							[ _('已识别协议'), formatNumber(protocols.length) ]
						].map(function(metric) {
							return E('div', { 'class': 'ndpi-metric' }, [
								E('span', { 'class': 'ndpi-muted' }, metric[0]),
								E('strong', {}, metric[1])
							]);
						})),
						E('section', { 'class': 'ndpi-card' }, [
							E('h3', {}, _('协议流量分布')),
							E('p', { 'class': 'ndpi-muted' }, _('按流量排序，前 9 项之外的协议合并为“其他协议”。')),
							chartContainer,
							E('ul', { 'class': 'ndpi-legend' }, chartData(protocols).map(function(item) {
								var name = item.label.substring(0, item.label.lastIndexOf(': '));
								return E('li', {}, [
									E('span', { 'class': 'ndpi-swatch', 'style': 'background: ' + item.color, 'aria-hidden': 'true' }),
									E('span', { 'class': 'ndpi-legend-name', 'title': name }, name),
									E('span', { 'class': 'ndpi-legend-value' }, formatBytes(item.value))
								]);
							}))
						]),
						E('section', { 'class': 'ndpi-card' }, [
							E('h3', {}, _('协议明细（前 20 项）')),
							E('div', { 'class': 'ndpi-table-wrap', 'tabindex': 0, 'role': 'region', 'aria-label': _('协议明细') }, E('table', { 'class': 'table ndpi-protocols' }, [
								E('thead', {}, E('tr', {}, [ _('协议'), _('流量'), _('数据包'), _('流'), _('占比') ].map(function(label) {
									return E('th', { 'scope': 'col' }, label);
								}))),
								E('tbody', {}, rows)
							]))
						]),
						E('section', { 'class': 'ndpi-card' }, [
							E('h3', {}, _('数据包长度分布')),
							packetLengthContainer
						]),
						E('details', { 'class': 'ndpi-card ndpi-details' }, [
							E('summary', {}, _('详细流量统计')),
							E('div', { 'class': 'ndpi-table-wrap' }, E('table', { 'class': 'table' }, [
								E('tbody', {}, trafficRows.map(function(row) {
									return E('tr', {}, [ E('th', { 'scope': 'row' }, row[0]), E('td', {}, row[1]) ]);
								}))
							]))
						])
					]),
					E('div', { 'class': 'ndpi-actions' }, [
						E('button', {
							'class': 'btn cbi-button cbi-button-neutral',
							'click': function() { close(); showTextReport(reportText); }
						}, _('文字报告')),
						E('button', {
							'class': 'btn cbi-button cbi-button-neutral',
							'click': function() { close(); showOutput(id, 'raw'); }
						}, _('查看原始数据')),
						E('button', { 'class': 'btn cbi-button cbi-button-action', 'click': close }, _('关闭'))
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
								percentageInnerCutout: 65,
								responsive: true,
								showTooltips: true
							}));
							chartMessage.textContent = _('将鼠标悬停在图表区域可查看协议与流量。');
						}
						if (packetLengthTotal > 0) {
							registerPacketLengthChart(Chart);
							activeCharts.push(new Chart(packetLengthCanvas.getContext('2d')).PacketLength(packetLengthChartData(metrics), { responsive: true }));
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
			var entries = String(text || '').trim().split('\n').filter(Boolean);
			reportCount.textContent = _('%s / 10 条记录').format(entries.length);
			dom.content(reports, entries.map(function(line) {
				var fields = line.split('\t');
				var id = fields[0];
				return E('tr', {}, [
					E('td', {}, formatTime(fields[1])),
					E('td', {}, E('span', { 'class': 'ndpi-device' }, fields[3] || '-')),
					E('td', { 'style': 'white-space: nowrap' }, formatDuration(fields[2])),
					E('td', {}, [
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
				reports.appendChild(E('tr', {}, E('td', { 'colspan': 4 }, E('div', { 'class': 'ndpi-empty' }, [
					E('strong', {}, _('还没有采集记录')),
					E('span', { 'class': 'ndpi-muted' }, _('选择采集时长并开始，完成后会在这里自动显示报告。'))
				]))));
		}

		function renderStatus(next) {
			var messages = {
				collecting: _('正在采集 WAN 接口 %s，已于 %s 开始；计划持续 %s。').format(next.device || '-', formatTime(next.started), formatDuration(next.duration)),
				complete: _('最近一次采集已完成。'),
				failed: _('最近一次采集失败：%s').format(next.error || _('未知错误')),
				idle: _('当前没有运行中的采集任务。')
			};
			var labels = {
				collecting: _('正在采集'), complete: _('采集完成'),
				failed: _('采集失败'), idle: _('等待采集')
			};
			var currentState = labels[next.state] ? next.state : 'idle';
			statusBadge.textContent = labels[currentState];
			statusBadge.setAttribute('data-state', currentState);
			state.setAttribute('data-state', currentState);
			var content = [
				E('strong', {}, labels[currentState]),
				E('div', { 'class': 'ndpi-muted' }, messages[currentState])
			];
			collectionRunning = currentState === 'collecting';
			if (collectionRunning && Number(next.duration) > 0 && Number(next.started) > 0) {
				var elapsed = Math.max(0, Math.floor(Date.now() / 1000) - Number(next.started));
				var remaining = Math.max(0, Number(next.duration) - elapsed);
				content.push(E('progress', {
					'class': 'ndpi-progress', 'max': Number(next.duration),
					'value': Math.min(elapsed, Number(next.duration)), 'aria-label': _('采集进度')
				}));
				content.push(E('div', { 'class': 'ndpi-muted' }, remaining
					? _('预计剩余 %s').format(formatDuration(remaining))
					: _('正在结束采集并生成报告…')));
			}
			dom.content(state, content);
			startButton.textContent = collectionRunning ? _('采集中…') : _('开始采集');
			startButton.disabled = collectionRunning;
			duration.disabled = collectionRunning;
			updatePresets();
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

		return E('div', { 'class': 'ndpi-page' }, [
			E('link', { 'rel': 'stylesheet', 'href': L.resource('view/ndpi_collector/overview.css') }),
			E('h2', {}, _('nDPI WAN 流量分析')),
			E('div', { 'class': 'ndpi-heading' }, [
				E('div', { 'class': 'cbi-map-descr' }, _('限时采集 WAN 流量，了解网络中的协议与应用分布。')),
				statusBadge
			]),
			E('section', { 'class': 'ndpi-card' }, [
				E('div', { 'class': 'ndpi-section-heading' }, [
					E('h3', {}, _('新建采集')),
					E('span', { 'class': 'ndpi-muted' }, _('后台运行 · 每 5 秒刷新状态'))
				]),
				E('div', { 'class': 'ndpi-setup' }, [
					E('div', {}, [
						E('label', { 'class': 'ndpi-label', 'for': 'ndpi-duration' }, _('采集时长')),
						E('div', { 'class': 'ndpi-input-row' }, [ duration, E('span', {}, _('秒')), startButton ]),
						E('div', { 'class': 'ndpi-presets', 'role': 'group', 'aria-label': _('常用采集时长') }, presetButtons),
						E('p', { 'class': 'ndpi-muted', 'id': 'ndpi-duration-help' }, _('支持 1 秒至 12 小时，同一时间只能运行一个采集任务。'))
					]),
					state
				])
			]),
			E('section', { 'class': 'ndpi-card' }, [
				E('div', { 'class': 'ndpi-section-heading' }, [
					E('div', {}, [
						E('h3', {}, _('采集记录')),
						E('p', { 'class': 'ndpi-muted' }, _('保留最近 10 次结果，设备重启后清除。'))
					]),
					reportCount
				]),
				E('div', { 'class': 'ndpi-table-wrap', 'tabindex': 0, 'role': 'region', 'aria-label': _('采集记录') }, E('table', { 'class': 'table ndpi-history' }, [
					E('thead', {}, E('tr', {}, [ _('完成时间'), _('WAN 接口'), _('采集时长'), _('操作') ].map(function(label) {
						return E('th', { 'scope': 'col' }, label);
					}))),
					reports
				]))
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
