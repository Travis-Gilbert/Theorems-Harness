// Headless Ghidra exporter for the Theorems Harness reconstruct(binary_from_source)
// product tool.
//
// Invocation shape:
// analyzeHeadless <project-dir> theorems-harness -import artifact \
//   -scriptPath <this-dir> -postScript ExportHarnessFacts.java output.json 256 30 2000

import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileOptions;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.Instruction;
import ghidra.program.model.listing.InstructionIterator;
import ghidra.program.model.listing.Listing;
import ghidra.program.model.pcode.PcodeOp;
import ghidra.program.model.symbol.ExternalLocation;
import ghidra.program.model.symbol.SymbolTable;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

public class ExportHarnessFacts extends GhidraScript {
    private static final int DEFAULT_MAX_FUNCTIONS = 256;
    private static final int DEFAULT_TIMEOUT_SECONDS = 30;
    private static final int DEFAULT_MAX_PCODE_OPS = 2000;

    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        String outputPath = args.length > 0 ? args[0] : "theorems-harness-ghidra-facts.json";
        int maxFunctions = intArg(args, 1, DEFAULT_MAX_FUNCTIONS);
        int timeoutSeconds = intArg(args, 2, DEFAULT_TIMEOUT_SECONDS);
        int maxPcodeOps = intArg(args, 3, DEFAULT_MAX_PCODE_OPS);

        Listing listing = currentProgram.getListing();
        SymbolTable symbols = currentProgram.getSymbolTable();
        List<Function> functions = new ArrayList<>();
        for (Function function : currentProgram.getFunctionManager().getFunctions(true)) {
            if (functions.size() >= maxFunctions) {
                break;
            }
            functions.add(function);
        }

        List<String> functionFacts = new ArrayList<>();
        List<String> importFacts = new ArrayList<>();
        List<String> callEdgeFacts = new ArrayList<>();
        List<String> pcodeFacts = new ArrayList<>();
        List<String> decompilerFacts = new ArrayList<>();
        List<String> diagnostics = new ArrayList<>();

        DecompInterface decompiler = new DecompInterface();
        decompiler.setOptions(new DecompileOptions());
        decompiler.openProgram(currentProgram);

        int pcodeCount = 0;
        for (Function function : functions) {
            monitor.checkCancelled();
            String entry = address(function.getEntryPoint());
            functionFacts.add("    {" +
                "\"function_id\": " + json("ghidra:function:" + entry) + ", " +
                "\"name\": " + json(function.getName()) + ", " +
                "\"entry_point\": " + json(entry) + ", " +
                "\"body_size\": " + function.getBody().getNumAddresses() +
                "}");

            try {
                Set<Function> calls = function.getCalledFunctions(monitor);
                for (Function callee : calls) {
                    callEdgeFacts.add("    {" +
                        "\"edge_id\": " + json("ghidra:call:" + entry + ":" + address(callee.getEntryPoint())) + ", " +
                        "\"caller\": " + json("ghidra:function:" + entry) + ", " +
                        "\"callee\": " + json("ghidra:function:" + address(callee.getEntryPoint())) + ", " +
                        "\"callee_name\": " + json(callee.getName()) +
                        "}");
                }
            }
            catch (Exception e) {
                diagnostics.add(diagnostic("call_edge", function.getName(), e.getMessage()));
            }

            try {
                DecompileResults result = decompiler.decompileFunction(function, timeoutSeconds, monitor);
                String status = result.decompileCompleted() ? "ok" : "degraded";
                String c = result.decompileCompleted() && result.getDecompiledFunction() != null
                    ? limit(result.getDecompiledFunction().getC(), 12000)
                    : "";
                decompilerFacts.add("    {" +
                    "\"function_id\": " + json("ghidra:function:" + entry) + ", " +
                    "\"status\": " + json(status) + ", " +
                    "\"error\": " + json(result.getErrorMessage()) + ", " +
                    "\"c_preview\": " + json(c) +
                    "}");
            }
            catch (Exception e) {
                diagnostics.add(diagnostic("decompiler", function.getName(), e.getMessage()));
            }

            InstructionIterator instructions = listing.getInstructions(function.getBody(), true);
            while (instructions.hasNext() && pcodeCount < maxPcodeOps) {
                Instruction instruction = instructions.next();
                for (PcodeOp op : instruction.getPcode()) {
                    if (pcodeCount >= maxPcodeOps) {
                        break;
                    }
                    pcodeFacts.add("    {" +
                        "\"pcode_id\": " + json("ghidra:pcode:" + address(instruction.getAddress()) + ":" + pcodeCount) + ", " +
                        "\"function_id\": " + json("ghidra:function:" + entry) + ", " +
                        "\"address\": " + json(address(instruction.getAddress())) + ", " +
                        "\"opcode\": " + json(op.getMnemonic()) + ", " +
                        "\"text\": " + json(op.toString()) +
                        "}");
                    pcodeCount++;
                }
            }
        }
        decompiler.dispose();

        for (ExternalLocation external : symbols.getExternalLocations()) {
            importFacts.add("    {" +
                "\"import_id\": " + json("ghidra:import:" + external.toString()) + ", " +
                "\"name\": " + json(external.getLabel()) + ", " +
                "\"location\": " + json(external.toString()) +
                "}");
        }

        try (PrintWriter out = new PrintWriter(new FileWriter(outputPath))) {
            out.println("{");
            out.println("  \"fixture\": {");
            out.println("    \"fixture_id\": " + json("ghidra:harness:" + currentProgram.getName()) + ",");
            out.println("    \"source_uri\": " + json(currentProgram.getExecutablePath()) + ",");
            out.println("    \"export_script\": \"ExportHarnessFacts.java\",");
            out.println("    \"program_summary\": {");
            out.println("      \"ghidra_version\": " + json(getGhidraVersion()) + ",");
            out.println("      \"language_id\": " + json(currentProgram.getLanguageID().toString()) + ",");
            out.println("      \"compiler_spec_id\": " + json(currentProgram.getCompilerSpec().getCompilerSpecID().toString()) + ",");
            out.println("      \"function_count\": " + functions.size() + ",");
            out.println("      \"import_count\": " + importFacts.size() + ",");
            out.println("      \"pcode_op_count\": " + pcodeFacts.size());
            out.println("    }");
            out.println("  },");
            writeArray(out, "functions", functionFacts);
            out.println(",");
            writeArray(out, "imports", importFacts);
            out.println(",");
            writeArray(out, "call_edges", callEdgeFacts);
            out.println(",");
            writeArray(out, "pcode_ops", pcodeFacts);
            out.println(",");
            writeArray(out, "decompiler_facts", decompilerFacts);
            out.println(",");
            writeArray(out, "diagnostics", diagnostics);
            out.println();
            out.println("}");
        }
    }

    private void writeArray(PrintWriter out, String name, List<String> values) {
        out.println("  \"" + name + "\": [");
        for (int i = 0; i < values.size(); i++) {
            out.print(values.get(i));
            if (i + 1 < values.size()) {
                out.println(",");
            }
            else {
                out.println();
            }
        }
        out.print("  ]");
    }

    private String diagnostic(String phase, String target, String message) {
        return "    {" +
            "\"phase\": " + json(phase) + ", " +
            "\"target\": " + json(target) + ", " +
            "\"message\": " + json(message) +
            "}";
    }

    private int intArg(String[] args, int index, int fallback) {
        if (args.length <= index) {
            return fallback;
        }
        try {
            return Integer.parseInt(args[index]);
        }
        catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private String address(Object value) {
        return value == null ? "" : value.toString();
    }

    private String limit(String value, int max) {
        if (value == null || value.length() <= max) {
            return value == null ? "" : value;
        }
        return value.substring(0, max);
    }

    private String json(String value) {
        if (value == null) {
            return "null";
        }
        StringBuilder builder = new StringBuilder();
        builder.append('"');
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            switch (ch) {
                case '"':
                    builder.append("\\\"");
                    break;
                case '\\':
                    builder.append("\\\\");
                    break;
                case '\n':
                    builder.append("\\n");
                    break;
                case '\r':
                    builder.append("\\r");
                    break;
                case '\t':
                    builder.append("\\t");
                    break;
                default:
                    if (ch < 0x20) {
                        builder.append(String.format("\\u%04x", (int) ch));
                    }
                    else {
                        builder.append(ch);
                    }
            }
        }
        builder.append('"');
        return builder.toString();
    }
}
