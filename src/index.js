const fs = require('fs');

const chalk = require('chalk');

const puppeteer = require('puppeteer');

const log = console.log;
const { parseAsync } = require('json2csv');

const baseURL = 'https://apps.cpuc.ca.gov/apex/';

const json2csv = require('json2csv');

async function main() {
  const browser = await puppeteer.launch({headless: false});
  log(chalk.green('browser start'));
  // let data = {
  //   dockets: []
  // };
  let dockets = new Array();
  try {
    let page = await browser.newPage();
    page.on('console', msg => {
      if (typeof msg === 'object') {
        console.dir(msg)
      } else {
        log(chalk.blue(msg))
      }
    });

    // Configure the navigation timeout
    await page.setDefaultNavigationTimeout(0);

    await page.goto('https://apps.cpuc.ca.gov/apex/f?p=401', {
      waitUntil: 'domcontentloaded', // Remove the timeout
      timeout: 0
    });

    await page.setViewport({
      width: 1200,
      height: 800
    });

    log(chalk.yellow('main search page loading done'));

    // const ht = await page.content();
    // log(ht);

    // search conditions, submit
    const fromDate = '06/01/2017';
    const toDate = '06/01/2020';
    // await page.type('#P1_FILED_DATE_L', fromDate, { delay: 100 });
    // await page.type('#P1_FILED_DATE_H', toDate, { delay: 100 });
    await page.click('#P1_SEARCH');

    await page.waitForNavigation({
      waitUntil: 'domcontentloaded'
    });

    log(chalk.yellow('search result page loading done'));
    const docketDetailPage = await browser.newPage();
    await docketDetailPage.setDefaultNavigationTimeout(0);
    let pageNum = 1;

    while(true) {
      await page.waitFor(5000);

      // go to detail page
      log(chalk.yellow('search result page: ', pageNum));
      const ht = await page.content();
      // log(ht);

      const docketLinks = await page.$$eval(
          '#\\31 19089023003070248410 > tbody > tr > td:nth-child(1) > a',
          links => {
            let arr = [];
            for (let link of links) {
              arr.push(link.href)
            }
            return arr
          });
      // const docketLinks = await page.$$('td[header="PROCEEDING_STATUS_DESC"] > a');

      for (let link of docketLinks) {
        log(link);
        await docketDetailPage.waitFor(5000);

        await docketDetailPage.goto(link, {
          waitUntil: 'domcontentloaded'
        });

        // scraping data:
        log(chalk.blue('start scraping one docket'));
        const docketDetail = await docketDetailPage.evaluate(() => {
          const docketNum = document.querySelector(
              'div.rc-body > div > div.rc-content-main > h1').innerText;
          const filedBy = document.querySelector('#P56_FILED_BY').innerText;
          const industry = document.querySelector('#P56_INDUSTRY').innerText;
          const fillingDate = document.querySelector(
              '#P56_FILING_DATE').innerText;
          const category = document.querySelector('#P56_CATEGORY').innerText;
          const status = document.querySelector('#P56_STATUS').innerText;
          const description = document.querySelector(
              '#P56_DESCRIPTION').innerText;
          const staff = document.querySelector('#P56_STAFF').innerText;

          return {
            docketNum,
            filedBy,
            industry,
            fillingDate,
            category,
            status,
            description,
            staff
          };
        });
        log(chalk.green('[get data]', JSON.stringify(docketDetail)));
        // data.dockets.push(docketDetail);
        dockets.push(docketDetail);

        log(chalk.blue('end scraping docket: ', docketDetail.docketNum));
        // only test first row in each page
        // break;
      }

      try {
        log('next page block');
        // await browser.pages()[1];
        await page.bringToFront();
        if(pageNum == 1) {
          await page.click('#apexir_DATA_PANEL > table > tbody > tr:nth-child(1) > td > span > a');
        } else {
          await page.click('#apexir_DATA_PANEL > table > tbody > tr:nth-child(1) > td > span > a:nth-child(2)');
        }
        pageNum += 1;
      } catch (e) {
        log(chalk.red(e.message));
        break;
      }
    }


    const fields = ['docketNum', 'filedBy', 'industry', 'fillingDate', 'category', 'status', 'description', 'staff'];
    const header = true;
    const opts = {fields, header};

    try {
      const parser = new json2csv.Parser(opts);
      const csv = parser.parse(dockets);
      fs.writeFileSync('ca_results.csv', csv, {flag: 'w'});
    } catch (err) {
      console.error(err.message);
    }

  }
  catch (error) {
    console.log(error);
    log(chalk.red('browser ends'));
    await browser.close()
  } finally
  {
    process.exit(0)
  }
}

main();
