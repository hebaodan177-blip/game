"use strict";

// ---------------- 棋盘 ----------------

  class Board {
    constructor(size = 8) {
      this.size = size;
      this.grid = [];
      this.specials = new Map();
      this.falls = new Map();
      this.dropPlan = [];
      this.reset();
    }

    reset() {
      this.grid = Array.from({ length: this.size }, () => Array(this.size));
      this.specials.clear();
      this.falls.clear();
      this.dropPlan = [];
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          let t;
          do t = choice(TYPES);
          while (this.wouldMatch(r, c, t));
          this.grid[r][c] = t;
        }
      }
    }

    wouldMatch(r, c, t) {
      return (c > 1 && this.grid[r][c - 1] === t && this.grid[r][c - 2] === t) ||
             (r > 1 && this.grid[r - 1][c] === t && this.grid[r - 2][c] === t);
    }

    swap(a, b) {
      [this.grid[a.r][a.c], this.grid[b.r][b.c]] = [this.grid[b.r][b.c], this.grid[a.r][a.c]];
      const ak = this.key(a), bk = this.key(b);
      const as = this.specials.get(ak), bs = this.specials.get(bk);
      if (as) this.specials.set(bk, as); else this.specials.delete(bk);
      if (bs) this.specials.set(ak, bs); else this.specials.delete(ak);
    }

    key(p) { return p.r + "," + p.c; }

    specialAt(p) { return this.specials.get(this.key(p)) || null; }

    matches() {
      const out = new Set();
      const n = this.size;
      for (let r = 0; r < n; r++) {
        let s = 0;
        for (let c = 1; c <= n; c++) {
          if (c < n && this.grid[r][c] === this.grid[r][s]) continue;
          if (this.grid[r][s] && c - s >= 3)
            for (let x = s; x < c; x++) out.add(r + "," + x);
          s = c;
        }
      }
      for (let c = 0; c < n; c++) {
        let s = 0;
        for (let r = 1; r <= n; r++) {
          if (r < n && this.grid[r][c] === this.grid[s][c]) continue;
          if (this.grid[s][c] && r - s >= 3)
            for (let y = s; y < r; y++) out.add(y + "," + c);
          s = r;
        }
      }
      return [...out].map(k => {
        const [r, c] = k.split(",").map(Number);
        return { r, c, type: this.grid[r][c], special: this.specialAt({ r, c }) };
      });
    }

    // 四连生成银星，五连生成金星；新特殊棋保留在匹配位置上等待下一次触发。
    promoteMatches(matches, preferred = null) {
      if (matches.some(p => p.special)) return matches;
      const positions = new Set(matches.map(p => this.key(p)));
      const runs = [];
      for (let r = 0; r < this.size; r++) {
        let c = 0;
        while (c < this.size) {
          const type = this.grid[r][c];
          const start = c++;
          while (c < this.size && this.grid[r][c] === type) c++;
          if (type && c - start >= 4) runs.push({ axis: "row", cells: Array.from({ length: c - start }, (_, i) => ({ r, c: start + i })) });
        }
      }
      for (let c = 0; c < this.size; c++) {
        let r = 0;
        while (r < this.size) {
          const type = this.grid[r][c];
          const start = r++;
          while (r < this.size && this.grid[r][c] === type) r++;
          if (type && r - start >= 4) runs.push({ axis: "col", cells: Array.from({ length: r - start }, (_, i) => ({ r: start + i, c })) });
        }
      }
      const created = [];
      runs.forEach(run => {
        const cells = run.cells.filter(p => positions.has(this.key(p)));
        if (cells.length < 4) return;
        const target = preferred && cells.some(p => p.r === preferred.r && p.c === preferred.c)
          ? preferred : cells[cells.length - 1];
        const special = cells.length >= 5
          ? { bonus: "color" }
          : { bonus: "line", axis: run.axis };
        this.specials.set(this.key(target), special);
        created.push(this.key(target));
      });
      if (!created.length) return matches;
      return matches.filter(p => !created.includes(this.key(p))).map(p => ({ ...p, special: null }));
    }

    // 展开特殊棋时始终用 visited 去重，保证交叉和连锁不会重复入列。
    expandSpecials(matches, colorTarget = null) {
      const out = [];
      const seen = new Set();
      matches.forEach(p => {
        const key = this.key(p);
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ ...p });
      });
      const push = (r, c) => {
        if (r < 0 || r >= this.size || c < 0 || c >= this.size) return;
        const key = r + "," + c;
        if (seen.has(key) || !this.grid[r][c]) return;
        seen.add(key);
        out.push({ r, c, type: this.grid[r][c], special: this.specialAt({ r, c }) });
      };
      for (let i = 0; i < out.length; i++) {
        const p = out[i], special = this.specialAt(p);
        if (!special) continue;
        if (special.bonus === "line") {
          if (special.axis === "row") for (let c = 0; c < this.size; c++) push(p.r, c);
          else for (let r = 0; r < this.size; r++) push(r, p.c);
        } else {
          const target = colorTarget || out.find(item => item.type && !item.special)?.type;
          if (target) for (let r = 0; r < this.size; r++) for (let c = 0; c < this.size; c++)
            if (this.grid[r][c] === target) push(r, c);
        }
      }
      return out;
    }

    clear(list) {
      list.forEach(p => {
        this.grid[p.r][p.c] = null;
        this.specials.delete(this.key(p));
      });
    }

    drop() {
      this.falls.clear();
      this.dropPlan = [];
      for (let c = 0; c < this.size; c++) {
        const kept = [];
        for (let r = 0; r < this.size; r++)
          if (this.grid[r][c]) kept.push({ type: this.grid[r][c], special: this.specialAt({ r, c }), from: r });
        const empty = this.size - kept.length;
        for (let r = 0; r < this.size; r++) {
          let fall = 0;
          if (r < empty) {
            this.grid[r][c] = choice(TYPES);
            this.specials.delete(this.key({ r, c }));
            // 新方块从棋盘上方连续生成，整批方块保持相同的下落距离。
            fall = empty;
          } else {
            const piece = kept[r - empty];
            this.grid[r][c] = piece.type;
            if (piece.special) this.specials.set(this.key({ r, c }), piece.special);
            else this.specials.delete(this.key({ r, c }));
            fall = r - piece.from;
          }
          if (fall) {
            const key = r + "," + c;
            this.falls.set(key, fall);
            this.dropPlan.push({ r, c, from: r - fall, distance: fall });
          }
        }
      }
      return this.dropPlan;
    }

    hasMove() {
      for (let r = 0; r < this.size; r++) for (let c = 0; c < this.size; c++) {
        for (const [dr, dc] of [[1, 0], [0, 1]]) {
          const nr = r + dr, nc = c + dc;
          if (nr >= this.size || nc >= this.size) continue;
          this.swap({ r, c }, { r: nr, c: nc });
          const ok = this.matches().length > 0;
          this.swap({ r, c }, { r: nr, c: nc });
          if (ok) return true;
        }
      }
      return false;
    }

    shuffle(maxAttempts = 50) {
      const pieces = this.grid.flat().filter(Boolean);
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        for (let i = pieces.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
        }
        let i = 0;
        for (let r = 0; r < this.size; r++) for (let c = 0; c < this.size; c++) this.grid[r][c] = pieces[i++];
        this.specials.clear();
        if (!this.matches().length && this.hasMove()) return true;
      }
      this.reset();
      return this.hasMove();
    }
  }
