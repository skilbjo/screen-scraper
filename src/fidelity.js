var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var querystring = require('querystring');
var S = require('string');
var numeral = require('numeral');

var formData = querystring.stringify({
  DEVICE_PRINT:'version=1&amp;pm_fpua=mozilla/5.0 (windows nt 6.1; wow64) applewebkit/537.36 (khtml, like gecko) chrome/46.0.2490.71 safari/537.36|5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2490.71 Safari/537.36|Win32&amp;pm_fpsc=24|1920|1080|1040&amp;pm_fpsw=&amp;pm_fptz=-4&amp;pm_fpln=lang=en-US|syslang=|userlang=&amp;pm_fpjv=1&amp;pm_fpco=1',
  SSN: '',
  SavedIdInd: 'N',
  PIN: ''
});

var current_proc_count = 0;

request = request.defaults({jar:true});
request.post({
    uri: 'https://login.fidelity.com/ftgw/Fas/Fidelity/RtlCust/Login/Response',
    headers: {
      //'content-length': formData.length,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body:  formData
}, function(error, response, body) {

  if(error) {
    console.error('Error logging in.')
    process.exit(1);
  }

  //console.log('symbol,pull_time,quarter_ending,metric_name,metric_value,group_name');
  fs.writeFile(process.argv[3], 'symbol,pull_time,quarter_ending,metric_name,metric_value,group_name\n', function (err) {
    if (err) throw err;
  });

  var rl = require('readline').createInterface({
    input: require('fs').createReadStream(process.argv[2])
  });

  var line_number = 1;
  rl.on('line', function (working_symbol) {

    setTimeout(function() {
      console.log('processing (' + working_symbol + ')');

      // bs
      //console.log('sending request for balance sheet (' + working_symbol + ')');
      request('https://eresearch.fidelity.com/eresearch/evaluate/fundamentals/financials.jhtml?stockspage=financials&symbols=' + working_symbol + '&period=quarterly', function(error, response, html) {
        if(error) {
          console.error('Error processing Balanace Sheet url: ' + working_symbol, error);
        } else {
          //console.log('got response for balance sheet (' + working_symbol + ')');
          print_financials(html, working_symbol, 'balance_sheet');
        }
      });

      // is
      //console.log('sending request for income statement (' + working_symbol + ')');
      request('https://eresearch.fidelity.com/eresearch/evaluate/fundamentals/financials.jhtml?stockspage=incomestatement&symbols=' + working_symbol + '&period=quarterly', function(error, response, html) {
        if(error) {
          console.error('Error processing Income Statement url: ' + working_symbol, error);
        } else {
          //console.log('got response for income statement (' + working_symbol + ')');
          print_financials(html, working_symbol, 'income_statement');
        }
      });

      // cf
      //console.log('sending request for cash flow (' + working_symbol + ')');
      request('https://eresearch.fidelity.com/eresearch/evaluate/fundamentals/financials.jhtml?stockspage=cashflow&symbols=' + working_symbol + '&period=quarterly', function(error, response, html) {
        if(error) {
          console.error('Error processing Cash Flow url: ' + working_symbol, error);
        } else {
          //console.log('got response for cash flow (' + working_symbol + ')');
          print_financials(html, working_symbol, 'cash_flow');
        }
      });

      // ks
      //console.log('sending request for key stats (' + working_symbol + ')');
      request('https://eresearch.fidelity.com/eresearch/evaluate/quote.jhtml?symbols=' + working_symbol, function(error, response, html) {
        if(error) {
          console.error('Error processing Key Stats url: ' + working_symbol, error);
        } else {
          //console.log('got response for key stats (' + working_symbol + ')');
          print_keystats(html, working_symbol, 'key_statistics');
        }
      });
    }, 1000 * (line_number++));

  });
});

/**

*/
function print_keystats(html, symbol, group_name) {
  var $ = cheerio.load(html);
  var shit_jim_likes = [
    'last_trade',
    'shares_outstanding',
    'volume',
    'options',
    'market_capitalization',
    'shares_short',
    'pe_trailing_twelve_months',
    'peg_ratio_5year_projected',
    'price_performance_last_52_weeks'
  ];

  var isInShitJimLikes = function(prop_name) {
    for(var i = 0; i < shit_jim_likes.length;++i) {
      if(shit_jim_likes[i] === prop_name) return true;
    }
    return false;
  };

  $('.datatable-component').each(function(tableIndex, tableElement) {
    $(this).find('tr').each(function(rowIndex, rowElement) {
      var header = '';
      $(this).find('th,td').each(function(cellIndex, cellElement) {




        if(cellIndex === 0) {
          header = S($(this).children().remove().end().text().toLowerCase())
            .decodeHTMLEntities()
            .stripPunctuation()
            .humanize()
            .replaceAll('-', ' ')
            .underscore()
            .trim() // why not..
            .s;


        } else if(cellIndex === 1) {

          if(isInShitJimLikes(header)) {
            var text = '';
            if(header === 'options') {
              if(S($(this).text().toLowerCase()).decodeHTMLEntities().trim().s === 'yes') {
                text = '1';
              } else {
                text = '0';
              }
            } else {
              text = numeral().unformat(S($(this).text().toLowerCase()).decodeHTMLEntities().trim().s);
            }

            //console.log(symbol + ',' + new Date().toISOString() + ',' + new Date().toISOString() + "," + header + ',' + text + ',' + group_name);
            //fs.appendFileSync(process.argv[3], symbol + ',' + new Date().toISOString() + ',' + new Date().toISOString() + "," + header + ',' + text + ',' + group_name + '\n', function (err) {
            //  if (err) console.error('error writing output to file for symbol : ' + symbol, err);
            //});
            try
            {
              fs.appendFileSync(process.argv[3], symbol + ',' + new Date().toISOString() + ',' + new Date().toISOString() + "," + header + ',' + text + ',' + group_name + '\n');
            } catch(ex) {
              console.error('error writing output to file for symbol : ' + symbol, ex);
            }
          }
        }

      });
    });
  });
}

/**
ADD COMMENTS LATER BECAUSE YOUR NOT GOING TO REMEMBER WHAT YOU DID
*/
function print_financials(html, symbol, group_name) {
  var $ = cheerio.load(html);
  var dates = [];
  $('.datatable-component').each(function(tableIndex, tableElement) {
    $(this).find('tr').each(function(rowIndex, rowElement) {
      //var header = $(rowElement).children('td,th').text();
      var header = '';

      $(this).find('th,td').each(function(cellIndex, cellElement) {

        // ignore sub-cats for now
        //if($(this).hasClass(''))

        if(rowIndex === 0) { // dates row..
          if(cellIndex > 0 && dates.length <= 5) {
            //console.log('cell index > 0 ' + $(this).text());
            var d = S($(this).text()).trim().s;
            dates.push(
              S(
                d.substring(0, 4) + '-' +
                d.substring(6, 8) + '-' +
                d.substring(9, 11)
              ).trim().s
            );
            //console.log('dates[' + cellIndex + '] = ' + dates[cellIndex]);
          } else {
            dates.push('');
          }
        } else {
          if(cellIndex === 0) {
              header = S($(this).text().toLowerCase())
                .decodeHTMLEntities()
                .stripPunctuation()
                .humanize()
                .replaceAll('-', ' ')
                .underscore()
                .trim() // why not..
                .s;
          } else {
            if(header.length > 0) {
              var text = numeral().unformat(S($(this).text().toLowerCase()).decodeHTMLEntities().trim().s);
              //console.log(symbol + ',' + new Date().toISOString() + ',' + dates[cellIndex] + "," + header + ',' + text + ',' + group_name);
              //fs.appendFile(process.argv[3], symbol + ',' + new Date().toISOString() + ',' + dates[cellIndex] + "," + header + ',' + text + ',' + group_name + '\n', function (err) {
              //  if (err) console.error('error writing output to file for symbol : ' + symbol, err);
              //});
              try
              {
                fs.appendFileSync(process.argv[3], symbol + ',' + new Date().toISOString() + ',' + dates[cellIndex] + "," + header + ',' + text + ',' + group_name + '\n');
              } catch(ex) {
                console.error('error writing output to file for symbol : ' + symbol, ex);
              }
            }
          }
        }

      });
    });
  });
}
