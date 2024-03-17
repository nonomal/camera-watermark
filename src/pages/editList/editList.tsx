/* eslint-disable no-async-promise-executor */
import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useHistory } from 'react-router-dom';
import EditComponent, {
  ForWardRefHandler,
} from '@/components/editComponent/editComponent';
import { Icon } from '@iconify-icon/react';
import Lightbox from 'react-image-lightbox';
import 'react-image-lightbox/style.css'; // This only needs to be imported once in your app
import { Button } from '@/components/ui/button';
import Worker from '../../workers/index?worker';
import { saveFile } from '@/utils';

function EditList() {
  const location = useLocation<any>();
  const history = useHistory();
  const { infoList = [] } = location.state;
  const [list, setList] = useState([]);
  const [previewList, setPreviewList] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const editRefs = infoList.map(() => useRef<ForWardRefHandler>(null));

  useEffect(() => {
    setList(JSON.parse(JSON.stringify(infoList)));
    setPreviewList(new Array(infoList.length).fill(''));
  }, [infoList]);

  const jumpToEdit = (index: number) => {
    history.push('/edit', { editState: list[index] });
  };

  const downloadHandler = (ref: any, info: any) => {
    return new Promise(async (resolve) => {
      const downloadImageData = await ref.current?.exportImageUrl({})!;

      const worker = new Worker();
      worker.postMessage({
        imageData: downloadImageData,
      });
      worker.onmessage = (event) => {
        const { blob } = event.data;
        saveFile(blob, `${info.filename}_${+new Date()}.png`);
        worker.terminate();
        resolve(null);
      };
    });
  };

  return (
    <div className="font-bold w-full min-h-screen px-8 pt-20 pb-16">
      <div className="flex justify-center items-center mb-12">
        <Button
          onClick={async () => {
            for (let i = 0; i < editRefs.length; i++) {
              await downloadHandler(editRefs[i], list[i]);
            }
          }}
        >
          批量下载
        </Button>
      </div>
      <div className="flex flex-wrap">
        {list.map((item: any, index: number) => (
          <div
            key={index}
            className="group w-80 h-80 p-1 bg-white relative flex justify-center items-center mr-8 mb-8 shadow-slate-300"
          >
            <div className="hidden">
              <EditComponent
                file={item.file}
                exifInfo={item.exifInfo}
                imgUrl={item.imgUrl}
                ref={editRefs[index]}
                onPreviewImg={(imgData) => {
                  setPreviewList((previewImgList: any) => {
                    previewImgList[index] = imgData;
                    return JSON.parse(JSON.stringify(previewImgList));
                  });
                }}
              />
            </div>
            {previewList[index] && (
              <img src={previewList[index]} className="max-w-full max-h-full" />
            )}

            <div className="hidden group-hover:flex w-full h-full justify-center items-center bg-black bg-opacity-10 absolute left-0 top-0">
              <Icon
                icon="mdi:eye-outline"
                className="text-3xl cursor-pointer hover:!text-gray-950 "
                style={{ color: '#fff' }}
                onClick={() => {
                  setPhotoIndex(index);
                  setIsOpen(true);
                }}
              />
              <Icon
                icon="mdi:square-edit-outline"
                className="text-3xl ml-8 cursor-pointer hover:!text-gray-950 "
                style={{ color: '#fff' }}
                onClick={() => jumpToEdit(index)}
              />
            </div>
          </div>
        ))}
      </div>
      {isOpen && (
        <Lightbox
          mainSrc={previewList[photoIndex]}
          nextSrc={previewList[(photoIndex + 1) % previewList.length]}
          prevSrc={
            previewList[
              (photoIndex + previewList.length - 1) % previewList.length
            ]
          }
          onCloseRequest={() => setIsOpen(false)}
          onMovePrevRequest={() =>
            setPhotoIndex(
              (photoIndex + previewList.length - 1) % previewList.length
            )
          }
          onMoveNextRequest={() =>
            setPhotoIndex((photoIndex + 1) % previewList.length)
          }
        />
      )}
    </div>
  );
}

export default EditList;