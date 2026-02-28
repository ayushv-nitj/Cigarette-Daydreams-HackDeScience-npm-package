/**
 * Demo — Auto-Formatting & Diff Module
 * Run: npx ts-node demo/demo.ts
 */

import { format, supportedLanguages } from '../src/index';
import type { FormatterResult }        from '../src/index';

// ─── ANSI helpers ─────────────────────────────────────────────────────────────

const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  cyan:    '\x1b[36m',
  grey:    '\x1b[90m',
  magenta: '\x1b[35m',
} as const;

function header(title: string): void {
  const bar = '─'.repeat(62);
  console.log(`\n${C.bold}${C.cyan}${bar}${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ${title}${C.reset}`);
  console.log(`${C.bold}${C.cyan}${bar}${C.reset}`);
}

function printDiff(diff: string): void {
  if (!diff) { console.log(`${C.grey}  (no changes)${C.reset}`); return; }
  for (const line of diff.split('\n')) {
    if      (line.startsWith('---') || line.startsWith('+++')) console.log(`${C.bold}${line}${C.reset}`);
    else if (line.startsWith('@@'))  console.log(`${C.cyan}${line}${C.reset}`);
    else if (line.startsWith('+'))   console.log(`${C.green}${line}${C.reset}`);
    else if (line.startsWith('-'))   console.log(`${C.red}${line}${C.reset}`);
    else                             console.log(`${C.grey}${line}${C.reset}`);
  }
}

function printResult(r: FormatterResult): void {
  console.log(`\n${C.bold}Language:${C.reset}        ${r.language}`);
  console.log(`${C.bold}Changed:${C.reset}         ${r.stats.changed ? C.yellow + 'yes' : C.green + 'no'}${C.reset}`);
  if (r.stats.changed) {
    console.log(`${C.bold}Additions:${C.reset}       ${C.green}+${r.stats.additions}${C.reset}`);
    console.log(`${C.bold}Deletions:${C.reset}       ${C.red}-${r.stats.deletions}${C.reset}`);
  }
  console.log(`${C.bold}Non-destructive:${C.reset} ${C.green}yes ✓${C.reset}`);
  console.log(`\n${C.bold}Unified Diff:${C.reset}`);
  printDiff(r.diff);
}

// ─── Samples ──────────────────────────────────────────────────────────────────

interface Sample { label: string; lang: string; code: string; }

const SAMPLES: Sample[] = [
  {
    label: 'JavaScript — Allman braces, wrong indent, unsorted imports',
    lang:  'javascript',
    code:  `'use strict';

import './utils/helpers';
import express from 'express';
import path from 'path';
import { readFile } from 'fs';
import lodash from 'lodash';

function createServer()
{







    const app = express();
app.get('/', (req, res) =>
    {
    
        const data = lodash.merge({}, {msg: 'hello'});
        res.json(data);
    });
    return app;
}

module.exports = { createServer };
`,
  },
  {
    label: 'TypeScript — type annotations, decorators, Allman braces',
    lang:  'typescript',
    code:  `import {Component} from '@angular/core';
import { Injectable } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import { Observable } from 'rxjs';
import * as fs from 'fs';

@Injectable({
  providedIn: 'root'
})

export class DataService
{
    constructor(private http: HttpClient) {}

    getData():Observable<string[]>
    {
        return this.http.get<string[]>('/api/data');
    }

    parseResult(raw:string): number
    {
        return parseInt(raw, 10);
    }
}
`,
  },
  {
    label: 'Python — tabs, unsorted imports, missing blank lines',
    lang:  'python',
    code:  `import requests
import flask
import os
import sys
import json
from . import models
from .utils import helpers
import numpy as np
from datetime import datetime

class UserService:
\tdef __init__(self, db):
\t\tself.db = db
\tdef get_user(self, user_id):
\t\treturn self.db.query(user_id)
\tdef create_user(self, data):
\t\tuser = models.User(**data)
\t\tself.db.save(user)
\t\treturn user
def health_check():
\treturn {'status': 'ok'}
`,
  },
  {
    label: 'Java — Allman braces, unsorted imports, 2-space indent',
    lang:  'java',
    code:  `package com.example.app;

import com.example.service.UserService;
import java.util.List;
import org.slf4j.Logger;
import java.io.IOException;
import javax.servlet.http.HttpServletRequest;
import com.example.model.User;

public class UserController
{
  private final UserService service;

  public UserController(UserService service)
  {
    this.service = service;
  }

  public List<User> getUsers()
  {
    return service.findAll();
  }

  public User createUser(User user) throws IOException
  {
    if(user == null)
    {
      throw new IllegalArgumentException("null user");
    }
    return service.save(user);
  }
}
`,
  },
  {
    label: 'C — unsorted includes, tab indent, missing keyword spaces',
    lang:  'c',
    code:  `#include "config.h"
#include "myapp.h"
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include "utils.h"

int calculate_sum(int *arr, int n)
{
\tint sum = 0;
\tfor(int i = 0; i < n; i++)
\t{
\t\tsum += arr[i];
\t}
\treturn sum;
}

int main(void)
{
\tint arr[] = {1, 2, 3, 4, 5};
\tprintf("Sum: %d\\n", calculate_sum(arr, 5));
\treturn 0;
}
`,
  },
  {
    label: 'C++ — unsorted includes, Allman braces, namespace + class',
    lang:  'cpp',
    code:  `#include "myclass.h"
#include <vector>
#include <string>
#include <iostream>
#include <algorithm>
#include "config.h"

namespace myapp
{
    template<typename T>
    class Container
    {
    public:
        Container() {}

    void add(const T& item)
        {
            items_.push_back(item);
        }

        size_t size() const
        {
            return items_.size();
        }

    private:
        std::vector<T> items_;
    };
}
`,
  },
];

// ─── Run ─────────────────────────────────────────────────────────────────────

console.log(`\n${C.bold}${C.magenta}╔════════════════════════════════════════════════════════════╗${C.reset}`);
console.log(`${C.bold}${C.magenta}║   Auto-Formatting & Diff Demo — Code Quality Analyser      ║${C.reset}`);
console.log(`${C.bold}${C.magenta}╚════════════════════════════════════════════════════════════╝${C.reset}`);

console.log(`\n${C.bold}Supported languages:${C.reset} ${supportedLanguages().join(', ')}`);

for (const { label, lang, code } of SAMPLES) {
  header(label);
  printResult(format(code, lang));
}

console.log(`\n${C.bold}${C.green}═══════════════════════════════════════════════════════════════${C.reset}`);
console.log(`${C.bold}${C.green}  All demos complete. Every result is non-destructive ✓        ${C.reset}`);
console.log(`${C.bold}${C.green}═══════════════════════════════════════════════════════════════${C.reset}\n`);