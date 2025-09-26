import { WorkerError, CodeListingMap } from "../../common/workertypes";
import { BuildStep, BuildStepResult, gatherFiles, staleFiles, getWorkFileAsString, populateFiles, fixParamsWithDefines, putWorkFile, anyTargetChanged } from "../builder";
import { msvcErrorMatcher, parseListing } from "../listingutils";
import { EmscriptenModule, emglobal, execMain, loadNative, moduleInstFn, print_fn } from "../wasmutils";
import { preprocessMCPP } from "./mcpp";

// http://www.techhelpmanual.com/829-program_startup___exit.html
export function compileSmallerC(step: BuildStep): BuildStepResult {
  loadNative("smlrc");
  var params = step.params;
  // stderr
  var re_err1 = /^Error in "[/]*(.+)" [(](\d+):(\d+)[)]/;
  var errors: WorkerError[] = [];
  var errline = 0;
  var errpath = step.path;
  function match_fn(s) {
    var matches = re_err1.exec(s);
    if (matches) {
      errline = parseInt(matches[2]);
      errpath = matches[1];
    } else {
      errors.push({
        line: errline,
        msg: s,
        path: errpath,
      });
    }
  }
  gatherFiles(step, { mainFilePath: "main.c" });
  var destpath = step.prefix + '.asm';
  if (staleFiles(step, [destpath])) {
    var args = ['-seg16',
      //'-nobss',
      '-no-externs',
      '-I/usr/include',
      step.path, destpath];
    var smlrc: EmscriptenModule = emglobal.smlrc({
      instantiateWasm: moduleInstFn('smlrc'),
      noInitialRun: true,
      //logReadFiles:true,
      print: match_fn,
      printErr: match_fn,
    });
    // load source file and preprocess
    var code = getWorkFileAsString(step.path);
    var preproc = preprocessMCPP(step, null);
    if (preproc.errors) {
      return { errors: preproc.errors };
    }
    else code = preproc.code;
    // set up filesystem
    var FS = smlrc.FS;
    //setupFS(FS, '65-'+getRootBasePlatform(step.platform));
    populateFiles(step, FS);
    
    // Add standard library headers for SmallerC
    try {
      FS.mkdir('/usr/include');
    } catch (e) {
      // Directory might already exist
    }
    
    // Add standard C library headers
    var stdHeaders = {
      'stdio.h': `#ifndef _STDIO_H
#define _STDIO_H

typedef struct FILE FILE;
extern FILE *stdin, *stdout, *stderr;

int printf(const char *format, ...);
int sprintf(char *str, const char *format, ...);
int scanf(const char *format, ...);
int sscanf(const char *str, const char *format, ...);
int getchar(void);
int putchar(int c);
int puts(const char *s);
char *gets(char *s);
int fgetc(FILE *stream);
int fputc(int c, FILE *stream);
int fputs(const char *s, FILE *stream);
char *fgets(char *s, int size, FILE *stream);
int fprintf(FILE *stream, const char *format, ...);
int fscanf(FILE *stream, const char *format, ...);
FILE *fopen(const char *filename, const char *mode);
int fclose(FILE *stream);
int fflush(FILE *stream);
int feof(FILE *stream);
int ferror(FILE *stream);
long ftell(FILE *stream);
int fseek(FILE *stream, long offset, int whence);
size_t fread(void *ptr, size_t size, size_t count, FILE *stream);
size_t fwrite(const void *ptr, size_t size, size_t count, FILE *stream);
int remove(const char *filename);
int rename(const char *old, const char *new);

#define EOF (-1)
#define SEEK_SET 0
#define SEEK_CUR 1
#define SEEK_END 2

#endif`,
      'stdlib.h': `#ifndef _STDLIB_H
#define _STDLIB_H

#define NULL ((void*)0)
#define EXIT_SUCCESS 0
#define EXIT_FAILURE 1

typedef unsigned int size_t;

void *malloc(size_t size);
void *calloc(size_t num, size_t size);
void *realloc(void *ptr, size_t size);
void free(void *ptr);
void exit(int status);
void abort(void);
int atoi(const char *str);
long atol(const char *str);
double atof(const char *str);
int rand(void);
void srand(unsigned int seed);
int abs(int x);
long labs(long x);
void qsort(void *base, size_t num, size_t size, int (*compar)(const void*, const void*));
void *bsearch(const void *key, const void *base, size_t num, size_t size, int (*compar)(const void*, const void*));

#endif`,
      'string.h': `#ifndef _STRING_H
#define _STRING_H

typedef unsigned int size_t;

void *memcpy(void *dest, const void *src, size_t n);
void *memmove(void *dest, const void *src, size_t n);
void *memset(void *s, int c, size_t n);
int memcmp(const void *s1, const void *s2, size_t n);
void *memchr(const void *s, int c, size_t n);
char *strcpy(char *dest, const char *src);
char *strncpy(char *dest, const char *src, size_t n);
char *strcat(char *dest, const char *src);
char *strncat(char *dest, const char *src, size_t n);
int strcmp(const char *s1, const char *s2);
int strncmp(const char *s1, const char *s2, size_t n);
char *strchr(const char *s, int c);
char *strrchr(const char *s, int c);
char *strstr(const char *haystack, const char *needle);
size_t strlen(const char *s);
size_t strspn(const char *s, const char *accept);
size_t strcspn(const char *s, const char *reject);
char *strpbrk(const char *s, const char *accept);
char *strtok(char *str, const char *delim);

#endif`,
      'ctype.h': `#ifndef _CTYPE_H
#define _CTYPE_H

int isalnum(int c);
int isalpha(int c);
int iscntrl(int c);
int isdigit(int c);
int isgraph(int c);
int islower(int c);
int isprint(int c);
int ispunct(int c);
int isspace(int c);
int isupper(int c);
int isxdigit(int c);
int tolower(int c);
int toupper(int c);

#endif`,
      'stddef.h': `#ifndef _STDDEF_H
#define _STDDEF_H

#define NULL ((void*)0)
typedef unsigned int size_t;
typedef int ptrdiff_t;
typedef unsigned int wchar_t;

#define offsetof(type, member) ((size_t)&(((type*)0)->member))

#endif`,
      'limits.h': `#ifndef _LIMITS_H
#define _LIMITS_H

#define CHAR_BIT 8
#define SCHAR_MIN (-128)
#define SCHAR_MAX 127
#define UCHAR_MAX 255
#define CHAR_MIN SCHAR_MIN
#define CHAR_MAX SCHAR_MAX
#define SHRT_MIN (-32768)
#define SHRT_MAX 32767
#define USHRT_MAX 65535
#define INT_MIN (-2147483648)
#define INT_MAX 2147483647
#define UINT_MAX 4294967295U
#define LONG_MIN (-2147483648L)
#define LONG_MAX 2147483647L
#define ULONG_MAX 4294967295UL

#endif`,
      'float.h': `#ifndef _FLOAT_H
#define _FLOAT_H

#define FLT_RADIX 2
#define FLT_MANT_DIG 24
#define FLT_DIG 6
#define FLT_MIN_EXP (-125)
#define FLT_MAX_EXP 128
#define FLT_MIN 1.175494e-38F
#define FLT_MAX 3.402823e+38F
#define FLT_EPSILON 1.192093e-07F

#define DBL_MANT_DIG 53
#define DBL_DIG 15
#define DBL_MIN_EXP (-1021)
#define DBL_MAX_EXP 1024
#define DBL_MIN 2.225074e-308
#define DBL_MAX 1.797693e+308
#define DBL_EPSILON 2.220446e-16

#endif`,
      'assert.h': `#ifndef _ASSERT_H
#define _ASSERT_H

#ifdef NDEBUG
#define assert(expr) ((void)0)
#else
#define assert(expr) ((expr) ? (void)0 : __assert_fail(#expr, __FILE__, __LINE__, __func__))
#endif

void __assert_fail(const char *assertion, const char *file, unsigned int line, const char *function);

#endif`,
      'errno.h': `#ifndef _ERRNO_H
#define _ERRNO_H

extern int errno;

#define ENOENT 2
#define EIO 5
#define ENOMEM 12
#define EACCES 13
#define EEXIST 17
#define ENOTDIR 20
#define EISDIR 21
#define EINVAL 22

#endif`,
      'math.h': `#ifndef _MATH_H
#define _MATH_H

#define M_E 2.7182818284590452354
#define M_LOG2E 1.4426950408889634074
#define M_LOG10E 0.43429448190325182765
#define M_LN2 0.69314718055994530942
#define M_LN10 2.30258509299404568402
#define M_PI 3.14159265358979323846
#define M_PI_2 1.57079632679489661923
#define M_PI_4 0.78539816339744830962
#define M_1_PI 0.31830988618379067154
#define M_2_PI 0.63661977236758134308
#define M_2_SQRTPI 1.12837916709551257390
#define M_SQRT2 1.41421356237309504880
#define M_SQRT1_2 0.70710678118654752440

double sin(double x);
double cos(double x);
double tan(double x);
double asin(double x);
double acos(double x);
double atan(double x);
double atan2(double y, double x);
double sinh(double x);
double cosh(double x);
double tanh(double x);
double exp(double x);
double log(double x);
double log10(double x);
double pow(double x, double y);
double sqrt(double x);
double ceil(double x);
double floor(double x);
double fabs(double x);
double fmod(double x, double y);

#endif`
    };
    
    for (var header in stdHeaders) {
      try {
        FS.writeFile('/usr/include/' + header, stdHeaders[header]);
      } catch (e) {
        console.log('Warning: Could not write header file', header, e);
      }
    }
    
    FS.writeFile(step.path, code);
    fixParamsWithDefines(step.path, params);
    if (params.extra_compile_args) {
      args.unshift.apply(args, params.extra_compile_args);
    }
    execMain(step, smlrc, args);
    if (errors.length)
      return { errors: errors };
    var asmout = FS.readFile(destpath, { encoding: 'utf8' });
    putWorkFile(destpath, asmout);
  }
  return {
    nexttool: "yasm",
    path: destpath,
    args: [destpath],
    files: [destpath],
  };
}

export function assembleYASM(step: BuildStep): BuildStepResult {
  loadNative("yasm");
  var errors = [];
  gatherFiles(step, { mainFilePath: "main.asm" });
  var objpath = step.prefix + ".exe";
  var lstpath = step.prefix + ".lst";
  var mappath = step.prefix + ".map";
  if (staleFiles(step, [objpath])) {
    var args = ['-X', 'vc',
      '-a', 'x86', '-f', 'dosexe', '-p', 'nasm',
      '-D', 'freedos',
      //'-g', 'dwarf2',
      //'-I/share/asminc',
      '-o', objpath, '-l', lstpath, '--mapfile=' + mappath,
      step.path];
    // return yasm/*.ready*/
    var YASM: EmscriptenModule = emglobal.yasm({
      instantiateWasm: moduleInstFn('yasm'),
      noInitialRun: true,
      //logReadFiles:true,
      print: print_fn,
      printErr: msvcErrorMatcher(errors),
    });
    var FS = YASM.FS;
    //setupFS(FS, '65-'+getRootBasePlatform(step.platform));
    populateFiles(step, FS);
    //fixParamsWithDefines(step.path, step.params);
    execMain(step, YASM, args);
    if (errors.length)
      return { errors: errors };
    var objout, lstout, mapout;
    objout = FS.readFile(objpath, { encoding: 'binary' });
    lstout = FS.readFile(lstpath, { encoding: 'utf8' });
    mapout = FS.readFile(mappath, { encoding: 'utf8' });
    putWorkFile(objpath, objout);
    putWorkFile(lstpath, lstout);
    //putWorkFile(mappath, mapout);
    if (!anyTargetChanged(step, [objpath]))
      return;
    var symbolmap = {};
    var segments = [];
    var lines = parseListing(lstout, /\s*(\d+)\s+([0-9a-f]+)\s+([0-9a-f]+)\s+(.+)/i, 1, 2, 3);
    var listings: CodeListingMap = {};
    listings[lstpath] = { lines: lines, text: lstout };
    return {
      output: objout, //.slice(0),
      listings: listings,
      errors: errors,
      symbolmap: symbolmap,
      segments: segments
    };
  }
}

