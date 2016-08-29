/*! Angular-PDF Version: 1.3.0 | Released under an MIT license */
(function () {

  'use strict';

  angular.module('pdf', []).directive('ngPdf',[ '$window', function ($window) {
    var renderTask = null;
    var pdfLoaderTask = null;
    var debug = false;

    var backingScale = function (canvas) {
      var ctx = canvas.getContext('2d');
      var dpr = window.devicePixelRatio || 1;
      var bsr = ctx.webkitBackingStorePixelRatio ||
        ctx.mozBackingStorePixelRatio ||
        ctx.msBackingStorePixelRatio ||
        ctx.oBackingStorePixelRatio ||
        ctx.backingStorePixelRatio || 1;

      return dpr / bsr;
    };

    var setCanvasDimensions = function (canvas, w, h) {
      var ratio = backingScale(canvas);
      canvas.width = Math.floor(w * ratio);
      canvas.height = Math.floor(h * ratio);
      canvas.style.width = Math.floor(w) + 'px';
      canvas.style.height = Math.floor(h) + 'px';
      canvas.getContext('2d').setTransform(ratio, 0, 0, ratio, 0, 0);
      return canvas;
    };
    return {
      restrict: 'E',
      templateUrl: function (element, attr) {
        return attr.templateUrl ? attr.templateUrl : 'partials/viewer.html';
      },
      scope: {
        pdfUrl: '=',
        control: '='
      },
      link: function (scope, element, attrs) {
        element.css('display', 'block');
        var url = scope.pdfUrl;
        var httpHeaders = scope.httpHeaders;
        var pdfDoc = null;
        var pageToDisplay = isFinite(attrs.page) ? parseInt(attrs.page) : 1;
        var pageFit = attrs.scale === 'page-fit';
        var scale = attrs.scale > 0 ? attrs.scale : 1;
        var canvasid = attrs.canvasid || 'pdf-canvas';
        var canvas = document.getElementById(canvasid);

        debug = attrs.hasOwnProperty('debug') ? attrs.debug : false;
        var creds = attrs.usecredentials;
        var ctx = canvas.getContext('2d');
        var windowEl = angular.element($window);

        //Initialize control
        scope.internalControl = scope.control || {};
        scope.internalControl.nextPage = function () {
          scope.goNext();
        };
        scope.internalControl.previousPage = function () {
          scope.goPrevious();
        };
        scope.internalControl.goToPage = function (pageNum) {
          scope.pageNum = pageNum;
        };
        scope.internalControl.zoomIn = function () {
          scope.zoomIn();
        };
        scope.internalControl.zoomOut = function () {
          scope.zoomOut();
        };
        scope.internalControl.zoomFit = function () {
          scope.fit();
        }
        scope.internalControl.pageNum = pageToDisplay;
        scope.internalControl.isLoading = true;

        windowEl.on('scroll', function () {
          scope.$apply(function () {
            scope.scroll = windowEl[0].scrollY;
          });
        });

        PDFJS.disableWorker = true;
        scope.pageNum = pageToDisplay;

        scope.renderPage = function (num) {
          if (renderTask) {
            renderTask._internalRenderTask.cancel();
          }

          pdfDoc.getPage(num).then(function (page) {
            var viewport;
            var pageWidthScale;
            var renderContext;

            if (pageFit) {
              viewport = page.getViewport(1);
              var clientRect = element[0].getBoundingClientRect();
              pageWidthScale = clientRect.width / viewport.width;
              scale = pageWidthScale;
            }
            viewport = page.getViewport(scale);

            setCanvasDimensions(canvas, viewport.width, viewport.height);

            renderContext = {
              canvasContext: ctx,
              viewport: viewport
            };

            renderTask = page.render(renderContext);
            renderTask.promise.then(function () {
              if (typeof scope.internalControl.onPageRender === 'function') {
                scope.internalControl.onPageRender(scope.pageNum);
              }
            }).catch(function (reason) {
              console.log(reason);
            });
          });
        };

        scope.goPrevious = function () {
          if (scope.pageToDisplay <= 1) {
            return;
          }
          scope.pageToDisplay = parseInt(scope.pageToDisplay) - 1;
          scope.pageNum = scope.pageToDisplay;
        };

        scope.goNext = function () {
          if (scope.pageToDisplay >= pdfDoc.numPages) {
            return;
          }
          scope.pageToDisplay = parseInt(scope.pageToDisplay) + 1;
          scope.pageNum = scope.pageToDisplay;
        };

        scope.zoomIn = function () {
          pageFit = false;
          scale = parseFloat(scale) + 0.2;
          scope.renderPage(scope.pageToDisplay);
          return scale;
        };

        scope.zoomOut = function () {
          pageFit = false;
          scale = parseFloat(scale) - 0.2;
          scope.renderPage(scope.pageToDisplay);
          return scale;
        };

        scope.fit = function () {
          pageFit = true;
          scope.renderPage(scope.pageToDisplay);
        }

        scope.changePage = function () {
          scope.renderPage(scope.pageToDisplay);
        };

        scope.rotate = function () {
          if (canvas.getAttribute('class') === 'rotate0') {
            canvas.setAttribute('class', 'rotate90');
          } else if (canvas.getAttribute('class') === 'rotate90') {
            canvas.setAttribute('class', 'rotate180');
          } else if (canvas.getAttribute('class') === 'rotate180') {
            canvas.setAttribute('class', 'rotate270');
          } else {
            canvas.setAttribute('class', 'rotate0');
          }
        };

        function clearCanvas() {
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }

        function renderPDF() {
          clearCanvas();

          var params = {
            'url': url,
            'withCredentials': creds
          };

          if (httpHeaders) {
            params.httpHeaders = httpHeaders;
          }

          if (url && url.length) {
            pdfLoaderTask = PDFJS.getDocument(params, null, null, scope.internalControl.onProgress);
            pdfLoaderTask.then(
              function (_pdfDoc) {
                if (typeof scope.internalControl.onLoad === 'function') {
                  scope.internalControl.pageCount = _pdfDoc.numPages;
                  scope.internalControl.onLoad(_pdfDoc.numPages);
                  scope.internalControl.isLoading = false;
                }

                pdfDoc = _pdfDoc;
                scope.renderPage(scope.pageToDisplay);

                scope.$apply(function () {
                  scope.pageCount = _pdfDoc.numPages;
                });
              }, function (error) {
                if (error) {
                  if (typeof scope.internalControl.onError === 'function') {
                    scope.internalControl.onError(error);
                  }
                }
              }
            );
          }
        }

        scope.$watch('pageNum', function (newVal) {
          scope.pageToDisplay = parseInt(newVal);
          scope.internalControl.pageNum = scope.pageToDisplay;
          if (pdfDoc !== null) {
            scope.renderPage(scope.pageToDisplay);
          }
        });

        scope.$watch('pdfUrl', function (newVal) {
          if (newVal) {
            if (debug) {
              console.log('pdfUrl value change detected: ', scope.pdfUrl);
            }
            url = newVal;
            scope.pageNum = scope.pageToDisplay = pageToDisplay;
            scope.internalControl.isLoading = true;
            if (pdfLoaderTask) {
              pdfLoaderTask.destroy().then(function () {
                renderPDF();
              });
            } else {
              renderPDF();
            }
          }
        });

      }
    };
  } ]);
})();
