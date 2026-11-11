// Tiny helper shared by the test files
let failures = 0;
function check(name, ok, extra) {
    console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  (' + extra + ')' : ''));
    if (!ok) failures++;
}
function finish() {
    console.log(failures ? `\n${failures} test(s) failed` : '\nAll tests passed');
    process.exit(failures ? 1 : 0);
}
module.exports = { check, finish };
