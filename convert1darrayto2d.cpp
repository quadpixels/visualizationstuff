#include <stdio.h>

int main() {
  const int m=3, n=2;
  int a[] = { 1,2,3,4,5,6 };
  int b[m][n];

  int idx = 0;
  for (int r=0; r<m; r++) {
    for (int c=0; c<n; c++) {
      b[r][c] = a[idx];
      idx++;
    }
  }
  printf("Done.\n");
}
