/**
 * Bina tab dashboard dalam Sheet. Semua angka dikira oleh formula,
 * jadi dashboard dikemas kini sendiri selepas setiap upload.
 *
 * binaDashboard() hanya menyentuh tab Dashboard, Analisis dan Trend.
 * Tab Data tidak diubah. Selamat dijalankan semula (tab dibina semula).
 */

const TAB_ANALISIS = 'Analisis';
const TAB_TREND = 'Trend';
const SEMUA_TARIKH = 'Semua tarikh';

// Senarai tarikh unik (terbaru dahulu) sebagai teks dd/mm/yyyy, untuk dropdown.
const F_SENARAI_TARIKH =
  '=IFERROR(ARRAYFORMULA(TEXT(SORT(UNIQUE(FILTER(Data!A2:A,Data!A2:A<>"")),1,FALSE),"dd/mm/yyyy")),"")';

function binaDashboard() {
  semakAkses_(true);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(TAB_DATA)) throw new Error('Tab Data tiada. Jalankan setupSistem() dahulu.');

  binaDashboardUtama_(sediaTab_(ss, TAB_DASHBOARD));
  binaAnalisis_(sediaTab_(ss, TAB_ANALISIS));
  binaTrend_(sediaTab_(ss, TAB_TREND));

  ss.setActiveSheet(ss.getSheetByName(TAB_DASHBOARD));
  Logger.log('Dashboard siap.');
}

/** Dapatkan atau cipta tab, kosongkan kandungan, carta dan validation. */
function sediaTab_(ss, nama) {
  if (nama === TAB_DATA) throw new Error('Tab Data tidak boleh dikosongkan.');
  let sh = ss.getSheetByName(nama);
  if (!sh) sh = ss.insertSheet(nama);
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  sh.clear();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  sh.showColumns(1, sh.getMaxColumns());
  if (sh.getMaxColumns() < 26) sh.insertColumnsAfter(sh.getMaxColumns(), 26 - sh.getMaxColumns());
  return sh;
}

function dropdown_(sel, julatSenarai) {
  sel.setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInRange(julatSenarai, true)
    .setAllowInvalid(false)
    .build());
}

function tajuk_(sh, teks) {
  sh.getRange('A1').setValue(teks).setFontSize(16).setFontWeight('bold');
}

/** Pilih nilai pertama dalam senarai helper sebagai default dropdown. */
function setDefault_(sel, helperSel) {
  SpreadsheetApp.flush();
  const v = helperSel.getDisplayValue();
  if (v) sel.setValue(v);
}

/* 1. Dashboard Utama: pilih tarikh, carta bar hadir/jumlah per kelas */
function binaDashboardUtama_(sh) {
  tajuk_(sh, 'Dashboard Kehadiran Harian');

  sh.getRange('Z1').setValue('helper: senarai tarikh');
  sh.getRange('Z2').setFormula(F_SENARAI_TARIKH);

  sh.getRange('A3').setValue('Tarikh:').setFontWeight('bold');
  const pilih = sh.getRange('B3');
  dropdown_(pilih, sh.getRange('Z2:Z'));
  pilih.setBackground('#fff2cc');

  sh.getRange('A4').setValue('Keseluruhan:').setFontWeight('bold');
  sh.getRange('B4').setFormula('=IFERROR(SUM(B7:B)/SUM(C7:C),"")').setNumberFormat('0.00%');
  sh.getRange('C4').setFormula('=IF(COUNT(B7:B)=0,"",SUM(B7:B)&"/"&SUM(C7:C)&" murid, "&COUNT(B7:B)&" kelas")');

  sh.getRange('A6:D6').setValues([['Kelas', 'Hadir', 'Jumlah', 'Peratus']]).setFontWeight('bold');
  sh.getRange('A7').setFormula(
    '=IFERROR(FILTER({REGEXREPLACE(Data!B2:B,"(?i)^TINGKATAN\\s*","")&" "&Data!C2:C,' +
    'Data!D2:D,Data!E2:E,Data!F2:F},TEXT(Data!A2:A,"dd/mm/yyyy")=$B$3),"Tiada data untuk tarikh ini")');
  sh.getRange('D7:D').setNumberFormat('0.00%');
  sh.setFrozenRows(6);

  sh.insertChart(sh.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(sh.getRange('A6:C'))
    .setNumHeaders(1)
    .setPosition(3, 6, 0, 0)
    .setOption('title', 'Hadir / Jumlah per kelas (tarikh di B3)')
    .setOption('legend', { position: 'top' })
    .setOption('height', 1000)
    .setOption('width', 700)
    .build());

  sh.setColumnWidth(1, 200);
  sh.hideColumns(26);
  setDefault_(pilih, sh.getRange('Z2'));
}

/* 2. Analisis Kelas: purata per tingkatan + kelas terendah */
function binaAnalisis_(sh) {
  tajuk_(sh, 'Analisis Kelas');

  sh.getRange('Z1').setValue('helper: pilihan tempoh');
  sh.getRange('Z2').setValue(SEMUA_TARIKH);
  sh.getRange('Z3').setFormula(F_SENARAI_TARIKH);

  sh.getRange('A3').setValue('Tempoh:').setFontWeight('bold');
  const pilih = sh.getRange('B3');
  dropdown_(pilih, sh.getRange('Z2:Z'));
  pilih.setBackground('#fff2cc').setValue(SEMUA_TARIKH);
  sh.getRange('A4').setValue('Peratus = jumlah hadir / jumlah murid dalam tempoh (purata berwajaran).')
    .setFontStyle('italic');

  const sumber = 'FILTER(Data!B2:E,Data!A2:A<>"",($B$3="' + SEMUA_TARIKH +
    '")+(TEXT(Data!A2:A,"dd/mm/yyyy")=$B$3))';

  sh.getRange('A6').setValue('Purata per tingkatan').setFontWeight('bold');
  sh.getRange('A7:D7').setValues([['Tingkatan', 'Hadir', 'Jumlah', 'Peratus']]).setFontWeight('bold');
  sh.getRange('A8').setFormula('=IFERROR(SORT(QUERY(' + sumber + ',' +
    '"select Col1, sum(Col3), sum(Col4), sum(Col3)/sum(Col4) group by Col1 ' +
    'label Col1 \'\', sum(Col3) \'\', sum(Col4) \'\', sum(Col3)/sum(Col4) \'\'",0),4,TRUE),"Tiada data")');
  sh.getRange('D8:D').setNumberFormat('0.00%');

  sh.getRange('F6').setValue('Kelas mengikut kehadiran terendah').setFontWeight('bold');
  sh.getRange('F7:J7').setValues([['Tingkatan', 'Kelas', 'Hadir', 'Jumlah', 'Peratus']]).setFontWeight('bold');
  sh.getRange('F8').setFormula('=IFERROR(SORT(QUERY(' + sumber + ',' +
    '"select Col1, Col2, sum(Col3), sum(Col4), sum(Col3)/sum(Col4) group by Col1, Col2 ' +
    'label Col1 \'\', Col2 \'\', sum(Col3) \'\', sum(Col4) \'\', sum(Col3)/sum(Col4) \'\'",0),5,TRUE),"Tiada data")');
  sh.getRange('J8:J').setNumberFormat('0.00%');

  sh.setFrozenRows(7);
  sh.setColumnWidth(1, 190);
  sh.setColumnWidth(6, 190);
  sh.setColumnWidth(7, 170);
  sh.hideColumns(26);
}

/* 3. Trend Kehadiran: carta garisan sekolah vs satu kelas */
function binaTrend_(sh) {
  tajuk_(sh, 'Trend Kehadiran');

  sh.getRange('Z1').setValue('helper: senarai kelas');
  sh.getRange('Z2').setFormula(
    '=IFERROR(SORT(UNIQUE(FILTER(Data!B2:B&" - "&Data!C2:C,Data!A2:A<>""))),"")');
  sh.getRange('Y1').setValue('helper: tingkatan/kelas dipilih');
  sh.getRange('Y2').setFormula('=IFERROR(INDEX(SPLIT($B$3," - ",FALSE),1,1),"")');
  sh.getRange('Y3').setFormula('=IFERROR(INDEX(SPLIT($B$3," - ",FALSE),1,2),"")');

  sh.getRange('A3').setValue('Kelas:').setFontWeight('bold');
  const pilih = sh.getRange('B3');
  dropdown_(pilih, sh.getRange('Z2:Z'));
  pilih.setBackground('#fff2cc');

  sh.getRange('A6:B6').setValues([['Tarikh', 'Sekolah']]).setFontWeight('bold');
  sh.getRange('C6').setFormula('=IF($B$3="","Kelas",$B$3)').setFontWeight('bold');
  sh.getRange('A7').setFormula('=IFERROR(SORT(UNIQUE(FILTER(Data!A2:A,Data!A2:A<>""))),"")');
  sh.getRange('B7').setFormula(
    '=ARRAYFORMULA(IF(A7:A="","",SUMIF(Data!A2:A,A7:A,Data!D2:D)/SUMIF(Data!A2:A,A7:A,Data!E2:E)))');
  sh.getRange('C7').setFormula(
    '=ARRAYFORMULA(IF(A7:A="","",IFERROR(' +
    'SUMIFS(Data!D2:D,Data!A2:A,A7:A,Data!B2:B,$Y$2,Data!C2:C,$Y$3)/' +
    'SUMIFS(Data!E2:E,Data!A2:A,A7:A,Data!B2:B,$Y$2,Data!C2:C,$Y$3),"")))');
  sh.getRange('A7:A').setNumberFormat('dd/mm/yyyy');
  sh.getRange('B7:C').setNumberFormat('0.00%');
  sh.setFrozenRows(6);

  sh.insertChart(sh.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(sh.getRange('A6:C'))
    .setNumHeaders(1)
    .setPosition(3, 5, 0, 0)
    .setOption('title', 'Peratus kehadiran mengikut tarikh')
    .setOption('legend', { position: 'top' })
    .setOption('vAxis', { format: '#%' })
    .setOption('hAxis', { format: 'dd/MM' })
    .setOption('pointSize', 4)
    .setOption('interpolateNulls', false)
    .setOption('height', 400)
    .setOption('width', 800)
    .build());

  sh.setColumnWidth(2, 300);
  sh.setColumnWidth(3, 300);
  sh.hideColumns(25, 2);
  setDefault_(pilih, sh.getRange('Z2'));
}
