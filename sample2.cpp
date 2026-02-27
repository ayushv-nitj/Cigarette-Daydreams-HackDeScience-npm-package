void test1() {
    if (true) {
        for (int i = 0; i < 10; i++) {
            int x = i;
        }
    }
}

void test2() {
    if (true) {
        for (int i = 0; i < 10; i++) {
            int y = i;   // variable name different
        }
    }
}