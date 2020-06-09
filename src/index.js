const fs = require('fs');
const chalk = require('chalk');
const puppeteer = require('puppeteer');
const log = console.log;
const json2csv = require('json2csv');
const os = require('os');

async function main() {
    const browser = await puppeteer.launch({headless: false});
    log(chalk.green('browser start'));
    // let data = {
    //   dockets: []
    // };
    const eol = os.EOL;
    try {
        let page = await browser.newPage();
        page.on('console', msg => {
            if (typeof msg === 'object') {
                console.dir(msg);
            } else {
                log(chalk.blue(msg));
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
        const fromDate = '06/01/2019';
        const toDate = '06/01/2020';
        const proceedingNum = '';
        const filerName = '';
        const description = '';
        const assignment = '';

        // await page.type('#P1_PROCEEDING_NUM', proceedingNum, { delay: 100 });
        // await page.type('#P1_FILER_NAME', filerName, { delay: 100 });
        await page.type('#P1_FILED_DATE_L', fromDate, { delay: 100 });
        await page.type('#P1_FILED_DATE_H', toDate, { delay: 100 });
        // await page.type('#P1_DESCRIPTION', description, { delay: 100 });
        // await page.type('#P1_LAST_NAME', assignment, { delay: 100 });

        await page.click('#P1_SEARCH');
        let output = 'CA_results';


        output = proceedingNum? `${output}_${proceedingNum}`: output;
        output = filerName? `${output}_${filerName}`: output;
        output = fromDate? `${output}_${fromDate}`: output;
        output = toDate? `${output}_${toDate}`: output;
        output = description? `${output}_${description}`: output;
        output = assignment? `${output}_${assignment}`: output;
        output = `${output}.csv`;
        output = replaceAll(output, '/', '_');

        // log('before nav');
        // await page.waitForNavigation({
        //   waitUntil: 'networkidle0'
        // });
        // log('after nav');
        await page.waitFor(1500);

        log(chalk.yellow('search result page loading done'));
        const docketDetailPage = await browser.newPage();
        await docketDetailPage.setDefaultNavigationTimeout(0);
        let pageNum = 1;

        let dockets = [];

        while(true) {

            await page.waitFor(5000);

            // go to detail page
            log(chalk.yellow('search result page: ', pageNum));
            // const ht = await page.content();
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
                await docketDetailPage.waitFor(3500);

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

                exportJsonObjToCSV(docketDetail, output);
                log(chalk.blue('end scraping docket: ', docketDetail.docketNum));
                // only test first row in each page
                break;
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
   // write to file
   //      exportJsonObjToCSV(dockets);

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


const exportJsonObjToCSV = (data,  outputFile) => {
    const header = false;
    const fields = Object.keys(data);
    const opts = {fields, header};

    try {
        const parser = new json2csv.Parser(opts);
        const csv = parser.parse(data);

        log(outputFile);
        fs.writeFileSync(outputFile, `${csv}${os.EOL}`, {flag: 'a'});

    } catch (err) {
        console.error(err.message);
    }
};

const processDocketNumField = (docketNumField) => {

};

const replaceAll = (str , replaceKey , replaceVal) => {
    const reg = new RegExp(replaceKey , 'g');
    return str.replace(reg , replaceVal || '');
};

main();


