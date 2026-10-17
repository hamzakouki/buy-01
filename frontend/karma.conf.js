module.exports = function (config) {
  config.set({
    basePath: '',

    frameworks: ['jasmine'],

    plugins: [
      'karma-jasmine',
      'karma-chrome-launcher',
      'karma-jasmine-html-reporter',
      'karma-junit-reporter',
      'karma-coverage'
    ],

    coverageReporter: {
      dir: require('path').join(__dirname, 'coverage'),
      subdir: '.',
      reporters:[{ type: 'lcovonly'}]
    },

    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: [
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage'
        ]
      }
    },

    browsers: ['ChromeHeadlessNoSandbox'],

    reporters: ['progress', 'kjhtml', 'junit'],
    
    junitReporter: {
    outputDir: 'test-results',
    outputFile: 'karma-results.xml',
    useBrowserName: false
    },

    restartOnFileChange: true
  });
};