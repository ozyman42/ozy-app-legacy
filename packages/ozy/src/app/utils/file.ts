export function upload(): Promise<{contents: string, filename: string}> {
    const input = document.createElement("input");
    input.type = 'file';
    return new Promise(resolve => {
        input.onchange = () => {
            const reader = new FileReader();
            reader.readAsText(input.files![0]);
            console.log("files", input.files);
            reader.onload = (e) => {
                resolve({contents: e.target!.result as string, filename: input.files![0].name});
                input.remove();
            }
        }
        input.click();
    });
}