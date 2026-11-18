import "server-only";
import { Document, Line, Page, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Sudoku, WordSearch } from "@/lib/puzzles";

// A puzzle or its answers as a print-ready PDF at the exact size of its spot
// on the flatplan (in mm), for the designer to drop into the page. Black text
// on white with the built-in Helvetica font; the answers highlight in pink.

const MM = 72 / 25.4;
const PAD = 3 * MM;
const pink = "#f6b8d3";

const s = StyleSheet.create({
  page: { padding: PAD, fontFamily: "Helvetica", color: "#000", backgroundColor: "#fff" },
  title: { fontFamily: "Helvetica-Bold", marginBottom: 2 * MM },
  word: { fontSize: 7.5, marginBottom: 1.2 },
});

export type PuzzlePdf = { title: string; part: "puzzle" | "answers"; widthMm: number; heightMm: number; answersPage: number | null; data: WordSearch | Sudoku };

function WordGrid({ p, side, answers }: { p: WordSearch; side: number; answers: boolean }) {
  const cell = side / p.size;
  return (
    <View style={{ width: side, height: side, position: "relative" }}>
      {answers && (
        <Svg width={side} height={side} style={{ position: "absolute", top: 0, left: 0 }}>
          {p.placements.map((pl, i) => (
            <Line
              key={i}
              x1={(pl.col + 0.5) * cell}
              y1={(pl.row + 0.5) * cell}
              x2={(pl.col + pl.dc * (pl.word.length - 1) + 0.5) * cell}
              y2={(pl.row + pl.dr * (pl.word.length - 1) + 0.5) * cell}
              stroke={pink}
              strokeWidth={cell * 0.72}
              strokeLinecap="round"
            />
          ))}
        </Svg>
      )}
      {p.grid.map((row, r) => (
        <View key={r} style={{ flexDirection: "row", height: cell }}>
          {[...row].map((ch, c) => (
            <Text key={c} style={{ width: cell, height: cell, textAlign: "center", fontSize: cell * 0.58, paddingTop: cell * 0.18 }}>
              {ch}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function SudokuGrid({ p, side, answers }: { p: Sudoku; side: number; answers: boolean }) {
  const cell = side / 9;
  const thin = 0.5;
  const thick = 1.6;
  return (
    <View style={{ width: side, height: side, borderWidth: thick, borderColor: "#000" }}>
      {Array.from({ length: 9 }, (_, r) => (
        <View key={r} style={{ flexDirection: "row", height: (side - thick * 2) / 9 }}>
          {Array.from({ length: 9 }, (_, c) => {
            const given = p.puzzle[r * 9 + c];
            const shown = given || (answers ? p.solution[r * 9 + c] : 0);
            return (
              <Text
                key={c}
                style={{
                  width: (side - thick * 2) / 9,
                  textAlign: "center",
                  fontSize: cell * 0.55,
                  paddingTop: cell * 0.2,
                  fontFamily: given ? "Helvetica-Bold" : "Helvetica",
                  color: given ? "#000" : "#c2185b",
                  borderRightWidth: c === 8 ? 0 : c % 3 === 2 ? thick : thin,
                  borderBottomWidth: r === 8 ? 0 : r % 3 === 2 ? thick : thin,
                  borderColor: "#000",
                }}
              >
                {shown ? String(shown) : ""}
              </Text>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function PuzzleDocument({ d }: { d: PuzzlePdf }) {
  const w = d.widthMm * MM;
  const h = d.heightMm * MM;
  const titleSize = Math.max(8, Math.min(14, w / 22));
  const innerW = w - PAD * 2;
  const innerH = h - PAD * 2 - titleSize * 1.4 - 2 * MM;
  const ws = d.data.kind === "wordsearch" ? d.data : null;
  // A word search puzzle needs room for its word list: beside the grid on a
  // wide space, underneath on a tall one.
  const wide = innerW > innerH * 1.25;
  const listRows = ws && d.part === "puzzle" ? Math.ceil(ws.words.length / 3) : 0;
  const side = ws && d.part === "puzzle" ? (wide ? Math.min(innerH, innerW * 0.68) : Math.min(innerW, innerH - listRows * 9.5 - 2 * MM)) : Math.min(innerW, innerH);
  const heading = d.part === "answers" ? `Answers: ${d.title}` : d.title;
  return (
    <Document title={heading} author="Forget Me Not">
      <Page size={{ width: w, height: h }} style={s.page}>
        <Text style={[s.title, { fontSize: titleSize }]}>{heading}</Text>
        <View style={{ flexDirection: wide ? "row" : "column", gap: 2 * MM, alignItems: "flex-start" }}>
          {d.data.kind === "wordsearch" ? <WordGrid p={d.data} side={side} answers={d.part === "answers"} /> : <SudokuGrid p={d.data} side={side} answers={d.part === "answers"} />}
          {ws && d.part === "puzzle" && (
            <View style={{ flexDirection: wide ? "column" : "row", flexWrap: "wrap", width: wide ? innerW - side - 2 * MM : innerW }}>
              {ws.words.map((word) => (
                <Text key={word} style={[s.word, { width: wide ? "100%" : "33%" }]}>
                  {word}
                </Text>
              ))}
              {d.answersPage ? <Text style={[s.word, { width: "100%", marginTop: 2, fontSize: 6.5 }]}>Answers on page {d.answersPage}.</Text> : null}
            </View>
          )}
          {d.data.kind === "sudoku" && d.part === "puzzle" && (
            <Text style={{ fontSize: 7, width: wide ? innerW - side - 2 * MM : innerW }}>
              Fill the grid so every row, column and 3 × 3 box contains the numbers 1 to 9.{d.answersPage ? ` Answers on page ${d.answersPage}.` : ""}
            </Text>
          )}
        </View>
      </Page>
    </Document>
  );
}

export function renderPuzzlePdf(d: PuzzlePdf): Promise<Buffer> {
  return renderToBuffer(<PuzzleDocument d={d} />);
}
