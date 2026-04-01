/**
 * Magistrat Google Slides Add-on — Apps Script entry point.
 *
 * This file is pushed to Google via clasp. It serves the Vite-built
 * sidebar and provides the bridge that the React app calls through
 * __MAGISTRAT_GOOGLE_BRIDGE__.
 */

function onOpen() {
  SlidesApp.getUi()
    .createMenu("Magistrat")
    .addItem("Open sidebar", "showSidebar")
    .addToUi();
}

function onHomepage() {
  return CardService.newCardBuilder()
    .addSection(
      CardService.newCardSection().addWidget(
        CardService.newTextButton()
          .setText("Open Magistrat")
          .setOnClickAction(
            CardService.newAction().setFunctionName("showSidebar")
          )
      )
    )
    .build();
}

function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile("sidebar")
    .setTitle("Magistrat")
    .setWidth(320)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  SlidesApp.getUi().showSidebar(html);
}

// ── Bridge functions called from the sidebar via google.script.run ──

function getHostInfo() {
  var presentation = SlidesApp.getActivePresentation();
  return {
    host: "google_slides",
    platform: "web",
    documentId: presentation ? presentation.getId() : undefined,
  };
}

function getCapabilities() {
  return {
    readDeckSnapshot: true,
    applyPatchOps: true,
    selectObject: false,
    documentStateCarrier: true,
    revisionGuard: false,
  };
}

function readPresentation() {
  var presentation = SlidesApp.getActivePresentation();
  var slides = presentation.getSlides();
  var result = {
    documentId: presentation.getId(),
    slides: [],
  };

  for (var i = 0; i < slides.length; i++) {
    var slide = slides[i];
    var pageElements = slide.getPageElements();
    var elements = [];
    var slideTitle = '';

    for (var j = 0; j < pageElements.length; j++) {
      var el = pageElements[j];
      var element = {
        objectId: el.getObjectId(),
        elementType: el.getPageElementType().toString(),
        geometry: {
          left: el.getLeft(),
          top: el.getTop(),
          width: el.getWidth(),
          height: el.getHeight(),
          rotation: el.getRotation(),
        },
      };

      if (el.getPageElementType() === SlidesApp.PageElementType.SHAPE) {
        var shape = el.asShape();
        var textRange = shape.getText();
        if (textRange) {
          element.text = extractTextInfo(textRange);
        }
        // Extract slide title from TITLE or CENTERED_TITLE placeholder
        if (!slideTitle) {
          try {
            var pType = shape.getPlaceholderType();
            if (
              pType === SlidesApp.PlaceholderType.TITLE ||
              pType === SlidesApp.PlaceholderType.CENTERED_TITLE
            ) {
              slideTitle = shape.getText().asString().trim().split('\n')[0] || '';
            }
          } catch (e) {
            // Not a placeholder shape — skip
          }
        }
        try {
          var fill = shape.getFill();
          if (fill && fill.getSolidFill()) {
            var solidFill = fill.getSolidFill();
            element.fillColor = solidFill.getColor().asRgbColor().asHexString();
            element.fillAlpha = solidFill.getAlpha();
          }
        } catch (e) {
          // Theme fills can't be converted to RGB — skip
        }
        try {
          var border = shape.getBorder();
          if (border) {
            var weight = border.getWeight();
            if (weight > 0) {
              element.lineWidth = weight;
              try {
                var lineFill = border.getLineFill();
                if (lineFill && lineFill.getSolidFill()) {
                  element.lineColor = lineFill.getSolidFill().getColor().asRgbColor().asHexString();
                }
              } catch (e2) {
                // Theme line color can't be converted — skip
              }
            }
          }
        } catch (e) {
          // Border not available on this shape type — skip
        }
      } else if (el.getPageElementType() === SlidesApp.PageElementType.TABLE) {
        var table = el.asTable();
        var numRows = table.getNumRows();
        var numCols = table.getNumColumns();
        element.elementType = 'TABLE';
        element.table = {
          rows: numRows,
          columns: numCols,
          cells: [],
        };

        for (var r = 0; r < numRows; r++) {
          for (var c = 0; c < numCols; c++) {
            var cell = table.getCell(r, c);
            var cellData = {
              rowIndex: r,
              columnIndex: c,
              text: '',
              textRuns: [],
            };

            try {
              var cellFill = cell.getFill();
              if (cellFill && cellFill.getSolidFill()) {
                cellData.fillColor = cellFill.getSolidFill().getColor().asRgbColor().asHexString();
              }
            } catch (e) {
              /* theme fill — skip */
            }

            try {
              var cellText = cell.getText();
              if (cellText) {
                cellData.text = cellText.asString();
                var cellInfo = extractTextInfo(cellText);
                cellData.textRuns = cellInfo.runs;
                if (
                  cellInfo.paragraphs &&
                  cellInfo.paragraphs.length > 0 &&
                  cellInfo.paragraphs[0].alignment
                ) {
                  cellData.textAlignment = cellInfo.paragraphs[0].alignment;
                }
              }
            } catch (e) {
              /* no text */
            }

            try {
              var vAlign = cell.getContentAlignment();
              if (vAlign) {
                var vStr = vAlign.toString();
                if (vStr === 'TOP') cellData.verticalAlignment = 'TOP';
                else if (vStr === 'MIDDLE') cellData.verticalAlignment = 'MIDDLE';
                else if (vStr === 'BOTTOM') cellData.verticalAlignment = 'BOTTOM';
              }
            } catch (e) {
              /* not available */
            }

            var edges = ['TOP', 'BOTTOM', 'LEFT', 'RIGHT'];
            var edgeKeys = ['top', 'bottom', 'left', 'right'];
            var borders = {};
            for (var ei = 0; ei < edges.length; ei++) {
              try {
                var border = cell.getBorder(SlidesApp.BorderPosition[edges[ei]]);
                if (border) {
                  var bw = border.getWeight();
                  var bData = { width: bw };
                  try {
                    var bFill = border.getLineFill();
                    if (bFill && bFill.getSolidFill()) {
                      bData.color = bFill.getSolidFill().getColor().asRgbColor().asHexString();
                    }
                  } catch (e2) {
                    /* theme border color */
                  }
                  borders[edgeKeys[ei]] = bData;
                }
              } catch (e) {
                /* border not available */
              }
            }
            if (Object.keys(borders).length > 0) {
              cellData.borders = borders;
            }

            element.table.cells.push(cellData);
          }
        }
      } else if (el.getPageElementType() === SlidesApp.PageElementType.SHEETS_CHART) {
        var sheetsChart = el.asSheetsChart();
        element.elementType = 'CHART';
        try {
          var spreadsheetId = sheetsChart.getSpreadsheetId();
          var chartId = sheetsChart.getChartId();
          element.chart = {
            spreadsheetId: spreadsheetId,
            series: [],
            axes: [],
          };
          try {
            var spreadsheet = Sheets.Spreadsheets.get(spreadsheetId, {
              fields: 'sheets.charts',
            });
            var chartSpec = null;
            if (spreadsheet && spreadsheet.sheets) {
              for (var si = 0; si < spreadsheet.sheets.length; si++) {
                var sheetObj = spreadsheet.sheets[si];
                if (sheetObj.charts) {
                  for (var ci = 0; ci < sheetObj.charts.length; ci++) {
                    if (sheetObj.charts[ci].chartId === chartId) {
                      chartSpec = sheetObj.charts[ci].spec;
                      break;
                    }
                  }
                }
                if (chartSpec) break;
              }
            }
            if (chartSpec && chartSpec.basicChart) {
              element.chart.chartType = chartSpec.basicChart.chartType;
              if (chartSpec.basicChart.series) {
                for (var idx = 0; idx < chartSpec.basicChart.series.length; idx++) {
                  var s = chartSpec.basicChart.series[idx];
                  var seriesData = { index: idx };
                  var seriesColor = s.colorStyle || s.color;
                  if (seriesColor && seriesColor.rgbColor) {
                    var rgb = seriesColor.rgbColor;
                    var r = Math.round((rgb.red || 0) * 255);
                    var g = Math.round((rgb.green || 0) * 255);
                    var b = Math.round((rgb.blue || 0) * 255);
                    seriesData.color =
                      '#' +
                      ('0' + r.toString(16)).slice(-2) +
                      ('0' + g.toString(16)).slice(-2) +
                      ('0' + b.toString(16)).slice(-2);
                  }
                  if (s.type) {
                    seriesData.type = s.type;
                  }
                  element.chart.series.push(seriesData);
                }
                var anyLabels = false;
                for (var dli = 0; dli < chartSpec.basicChart.series.length; dli++) {
                  var dl = chartSpec.basicChart.series[dli].dataLabel;
                  if (dl && dl.type && dl.type !== 'NONE') {
                    anyLabels = true;
                    break;
                  }
                }
                element.chart.hasDataLabels = anyLabels;
              }
              if (chartSpec.basicChart.axis) {
                for (var ai = 0; ai < chartSpec.basicChart.axis.length; ai++) {
                  var axis = chartSpec.basicChart.axis[ai];
                  element.chart.axes.push({
                    position: axis.position,
                    title: axis.title || undefined,
                  });
                }
              }
            } else if (chartSpec && chartSpec.pieChart) {
              element.chart.chartType = 'PIE';
            }
          } catch (e) {
            /* Sheets Advanced Service not available or permission error */
          }
        } catch (e) {
          element.chart = undefined;
        }
      } else if (el.getPageElementType() === SlidesApp.PageElementType.IMAGE) {
        var image = el.asImage();
        element.elementType = 'IMAGE';
        try {
          var blob = image.getBlob();
          if (blob) {
            var contentType = blob.getContentType();
            if (contentType) {
              element.imageMimeType = contentType;
            }
            var bytes = blob.getBytes();
            var dims = getImageDimensions(bytes, contentType);
            if (dims) {
              element.intrinsicWidthPx = dims.width;
              element.intrinsicHeightPx = dims.height;
            }
          }
        } catch (e) {
          /* Blob not accessible (external URL image, DRM, etc.) — skip */
        }
      }

      elements.push(element);
    }

    result.slides.push({
      slideId: slide.getObjectId(),
      index: i + 1,
      title: slideTitle,
      pageElements: elements,
    });
  }

  return result;
}

function extractTextInfo(textRange) {
  var runs = [];
  var paragraphs = [];
  var textRuns = textRange.getRuns();

  for (var i = 0; i < textRuns.length; i++) {
    var run = textRuns[i];
    var style = run.getTextStyle();
    var fontColor = undefined;
    try {
      var fg = style.getForegroundColor();
      if (fg) fontColor = fg.asRgbColor().asHexString();
    } catch (e) {
      // Theme colors can't be converted to RGB directly — skip
    }

    runs.push({
      text: run.asString(),
      fontFamily: style.getFontFamily(),
      fontSizePt: style.getFontSize(),
      bold: style.isBold(),
      italic: style.isItalic(),
      fontColor: fontColor,
    });
  }

  var paras = textRange.getParagraphs();
  for (var j = 0; j < paras.length; j++) {
    var para = paras[j];
    var paraStyle = para.getRange().getParagraphStyle();
    var alignment = undefined;
    try {
      var rawAlignment = paraStyle.getParagraphAlignment();
      if (rawAlignment) {
        var alignStr = rawAlignment.toString();
        if (alignStr === 'START') alignment = 'LEFT';
        else if (alignStr === 'CENTER') alignment = 'CENTER';
        else if (alignStr === 'END') alignment = 'RIGHT';
        else if (alignStr === 'JUSTIFIED') alignment = 'JUSTIFIED';
      }
    } catch (e) {
      // Alignment not available — skip
    }
    paragraphs.push({
      level: paraStyle.getIndentStart() ? 1 : 0,
      lineSpacing: paraStyle.getLineSpacing(),
      alignment: alignment,
      text: para.getRange().asString(),
    });
  }

  return { runs: runs, paragraphs: paragraphs };
}

/**
 * Extract width/height from PNG or JPEG binary header.
 * Returns { width, height } or null if format not recognized.
 */
function getImageDimensions(bytes, contentType) {
  if (!bytes || bytes.length < 24) return null;

  // PNG: bytes 16-23 contain width (4 bytes BE) and height (4 bytes BE)
  if (contentType === 'image/png' || (bytes[0] === -119 && bytes[1] === 80)) {
    var w =
      ((bytes[16] & 0xff) << 24) |
      ((bytes[17] & 0xff) << 16) |
      ((bytes[18] & 0xff) << 8) |
      (bytes[19] & 0xff);
    var h =
      ((bytes[20] & 0xff) << 24) |
      ((bytes[21] & 0xff) << 16) |
      ((bytes[22] & 0xff) << 8) |
      (bytes[23] & 0xff);
    if (w > 0 && h > 0) return { width: w, height: h };
  }

  // JPEG: scan for SOF0 (0xFF 0xC0) or SOF2 (0xFF 0xC2) marker
  if (contentType === 'image/jpeg' || (bytes[0] === -1 && bytes[1] === -40)) {
    var offset = 2;
    while (offset < bytes.length - 9) {
      if ((bytes[offset] & 0xff) === 0xff) {
        var marker = bytes[offset + 1] & 0xff;
        if (marker === 0xc0 || marker === 0xc2) {
          var h = ((bytes[offset + 5] & 0xff) << 8) | (bytes[offset + 6] & 0xff);
          var w = ((bytes[offset + 7] & 0xff) << 8) | (bytes[offset + 8] & 0xff);
          if (w > 0 && h > 0) return { width: w, height: h };
        }
        var segLen = ((bytes[offset + 2] & 0xff) << 8) | (bytes[offset + 3] & 0xff);
        offset += 2 + segLen;
      } else {
        offset++;
      }
    }
  }

  // GIF: width at bytes 6-7 (LE), height at 8-9 (LE)
  if (contentType === 'image/gif' || (bytes[0] === 71 && bytes[1] === 73 && bytes[2] === 70)) {
    var gw = (bytes[6] & 0xff) | ((bytes[7] & 0xff) << 8);
    var gh = (bytes[8] & 0xff) | ((bytes[9] & 0xff) << 8);
    if (gw > 0 && gh > 0) return { width: gw, height: gh };
  }

  return null;
}

// ── Document state carrier (stored in document properties) ──

var STATE_KEY = "magistrat_state";

function getDocumentCarrier() {
  var props = PropertiesService.getDocumentProperties();
  return props.getProperty(STATE_KEY) || "";
}

function setDocumentCarrier(content) {
  var props = PropertiesService.getDocumentProperties();
  props.setProperty(STATE_KEY, content);
}

// ── Mutation apply (SAFE mode) ──

function applyMutations(mutations, options) {
  var presentation = SlidesApp.getActivePresentation();

  for (var i = 0; i < mutations.length; i++) {
    var mutation = mutations[i];
    var slide = findSlideById(presentation, mutation.slideId);
    if (!slide) continue;

    var element = findElementById(slide, mutation.objectId);
    if (!element) continue;

    applyMutation(element, mutation);
  }

  return { revisionId: undefined };
}

function findSlideById(presentation, slideId) {
  var slides = presentation.getSlides();
  for (var i = 0; i < slides.length; i++) {
    if (slides[i].getObjectId() === slideId) return slides[i];
  }
  return null;
}

function findElementById(slide, objectId) {
  var elements = slide.getPageElements();
  for (var i = 0; i < elements.length; i++) {
    if (elements[i].getObjectId() === objectId) return elements[i];
  }
  return null;
}

function applyMutation(element, mutation) {
  if (element.getPageElementType() !== SlidesApp.PageElementType.SHAPE) return;

  var shape = element.asShape();
  var fields = mutation.fields;

  if (fields.fontFamily || fields.fontSizePt || fields.bold !== undefined || fields.italic !== undefined || fields.fontColor) {
    var textRange = shape.getText();
    if (!textRange) return;
    var style = textRange.getTextStyle();

    if (fields.fontFamily) style.setFontFamily(fields.fontFamily);
    if (fields.fontSizePt) style.setFontSize(fields.fontSizePt);
    if (fields.bold !== undefined) style.setBold(fields.bold);
    if (fields.italic !== undefined) style.setItalic(fields.italic);
    if (fields.fontColor) {
      style.setForegroundColor(fields.fontColor);
    }
  }
}
