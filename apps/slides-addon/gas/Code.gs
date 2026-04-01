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
